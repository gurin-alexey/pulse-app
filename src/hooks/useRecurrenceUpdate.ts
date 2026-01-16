import { useUpdateTask } from './useUpdateTask'
import { useCreateTask } from './useCreateTask'
import { useTaskOccurrence } from './useTaskOccurrence'
import { addUntilToRRule, updateDTStartInRRule, updateRRuleByDay } from '@/utils/recurrence'
import type { Task } from '@/types/database'

export type RecurrenceUpdateMode = 'single' | 'following' | 'all'

interface RecurrenceUpdateParams {
    task: Task
    mode: RecurrenceUpdateMode
    occurrenceDate: string // YYYY-MM-DD
    updates: Partial<Task> // Helper updates (title, unknown fields)
}

export function useRecurrenceUpdate() {
    const { mutateAsync: updateTask } = useUpdateTask()
    const { mutateAsync: createTask } = useCreateTask()
    const { setOccurrenceStatus } = useTaskOccurrence()

    const confirmRecurrenceUpdate = async ({
        task,
        mode,
        occurrenceDate,
        updates
    }: RecurrenceUpdateParams) => {
        if (!task) return

        // Helper to calculate times for a specific occurrence date
        // (Used when keeping the same time but moving to a new object, or when defaulting)
        const getOccurrenceTimes = (baseDate: string) => {
            let start = null
            let end = null

            if (task.start_time) {
                const timePart = new Date(task.start_time).toISOString().split('T')[1]
                start = `${baseDate}T${timePart}`

                if (task.end_time) {
                    const startMs = new Date(task.start_time).getTime()
                    const endMs = new Date(task.end_time).getTime()
                    const duration = endMs - startMs
                    end = new Date(new Date(start).getTime() + duration).toISOString()
                }
            }
            return { start, end }
        }

        // 1. Single Instance Update
        if (mode === 'single') {
            if (occurrenceDate) {
                // Archive the specific instance in the original series
                setOccurrenceStatus({
                    taskId: task.id,
                    date: occurrenceDate,
                    status: 'archived'
                })

                // Calculate defaults based on the occurrence date
                // (If the user didn't change the time, we still need to set it for the new task)
                const defaults = getOccurrenceTimes(occurrenceDate)

                // Create new standalone task
                // We merge original task props -> defaults for this date -> specific updates
                // Explicitly set recurrence_rule to null to ensure it's an INDEPENDENT single task.
                await createTask({
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    projectId: task.project_id,
                    userId: task.user_id,
                    parentId: task.parent_id,
                    is_project: false,
                    // Defaults:
                    due_date: occurrenceDate,
                    start_time: defaults.start,
                    end_time: defaults.end,
                    // Overrides:
                    ...updates,
                    // Force no recurrence for single instance move
                    recurrence_rule: null
                })
            }
        }
        // 2. Following Instances Update
        else if (mode === 'following') {
            if (occurrenceDate) {
                // A. Truncate old series
                // We need to find the "split point". 
                // If the user dragged to a NEW time, the split point on the OLD series is technically 
                // the instance *before* this one. 
                // But typically we just end the old rule right before the occurrence Date.

                // Note: The logic in existing files dealt with "splitDateMs" sometimes being based on time.
                // Using the specific start time is safer for "until" calc.
                let splitDateMs = new Date(occurrenceDate).getTime()
                if (task.start_time) {
                    const timePart = new Date(task.start_time).toISOString().split('T')[1]
                    splitDateMs = new Date(`${occurrenceDate}T${timePart}`).getTime()
                }
                const prevTime = new Date(splitDateMs - 1000)

                const oldRuleEnd = addUntilToRRule(task.recurrence_rule || '', prevTime)
                await updateTask({ taskId: task.id, updates: { recurrence_rule: oldRuleEnd } })

                // B. Create NEW series
                // The new series starts at the new time (updates.start_time) or the old time on this date

                const newStartStr = updates.start_time ||
                    (updates.due_date ? `${updates.due_date}T00:00:00` : null) ||
                    new Date(splitDateMs).toISOString()

                const newStart = new Date(newStartStr)
                let newRule = updateDTStartInRRule(task.recurrence_rule || '', newStart)
                newRule = updateRRuleByDay(newRule, newStart)

                await createTask({
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    projectId: task.project_id,
                    userId: task.user_id,
                    parentId: task.parent_id,
                    is_project: false,
                    // Defaults:
                    due_date: updates.due_date || occurrenceDate,
                    start_time: updates.start_time || (task.start_time ? newStartStr : null),
                    end_time: updates.end_time || null,
                    // New Rule:
                    recurrence_rule: newRule,
                    // Apply other updates (like description)
                    ...updates
                })
            }
        }
        // 3. All Instances Update
        else {
            const finalUpdates = { ...updates }
            const baseRule = updates.recurrence_rule ?? task.recurrence_rule ?? ''
            let newRule = baseRule

            const hasStartTimeField = Object.prototype.hasOwnProperty.call(updates, 'start_time')
            const hasDueDateField = Object.prototype.hasOwnProperty.call(updates, 'due_date')

            if (hasStartTimeField) {
                // TIMED series (start_time provided)
            if (updates.start_time) {
                    // If a date was provided, we intentionally shift the whole series to that date.
                    // This enables "move all occurrences to this weekday" via drag.
                    const masterDateStr = (hasDueDateField && updates.due_date)
                        ? updates.due_date
                        : (task.start_time ? task.start_time.split('T')[0] : (task.due_date || new Date().toISOString().split('T')[0]))

                    const newTimePart = updates.start_time.split('T')[1]
                const newMasterStart = `${masterDateStr}T${newTimePart}`
                finalUpdates.start_time = newMasterStart
                    finalUpdates.due_date = masterDateStr

                if (updates.end_time) {
                    const updateStart = new Date(updates.start_time).getTime()
                    const updateEnd = new Date(updates.end_time).getTime()
                    const duration = updateEnd - updateStart
                    const newMasterStartMs = new Date(newMasterStart).getTime()
                        finalUpdates.end_time = new Date(newMasterStartMs + duration).toISOString()
                    } else if (task.end_time && task.start_time) {
                        const oldDuration = new Date(task.end_time).getTime() - new Date(task.start_time).getTime()
                        const newMasterStartMs = new Date(newMasterStart).getTime()
                        finalUpdates.end_time = new Date(newMasterStartMs + oldDuration).toISOString()
                    }

                    newRule = updateDTStartInRRule(baseRule, new Date(newMasterStart))
                    newRule = updateRRuleByDay(newRule, new Date(newMasterStart))
                } else {
                    // ALL-DAY series (start_time cleared)
                    finalUpdates.start_time = null
                    finalUpdates.end_time = null

                    if (hasDueDateField && updates.due_date) {
                        finalUpdates.due_date = updates.due_date
                        const newMasterStart = new Date(`${updates.due_date}T00:00:00`)
                        newRule = updateDTStartInRRule(baseRule, newMasterStart)
                        newRule = updateRRuleByDay(newRule, newMasterStart)
                    }
                }
            }

            // Always update rule if it exists
            finalUpdates.recurrence_rule = newRule

            await updateTask({
                taskId: task.id,
                updates: finalUpdates
            })
        }
    }

    return { confirmRecurrenceUpdate }
}
