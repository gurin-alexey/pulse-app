import { useUpdateTask } from './useUpdateTask'
import { useCreateTask } from './useCreateTask'
import { useTaskOccurrence } from './useTaskOccurrence'
import { addUntilToRRule, updateDTStartInRRule } from '@/utils/recurrence'
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
                const newRule = updateDTStartInRRule(task.recurrence_rule || '', newStart)

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
        // 3. All Instances Update
        else {
            const finalUpdates = { ...updates }
            let newRule = task.recurrence_rule

            // Logic: Users want to keep the Master Task on its original DATE, 
            // but update the TIME if it changed.
            // "Date changes will be later" — so we ignore due_date shifts for now.

            if (updates.start_time) {
                // 1. Get the original date from the Master Task
                // If master didn't have start_time, use due_date. 
                // We rely on the fact that the Master Task holds the "Show Date".
                const masterDateStr = task.start_time
                    ? task.start_time.split('T')[0]
                    : (task.due_date || new Date().toISOString().split('T')[0])

                // 2. Get the new time from the updates
                const newTimePart = updates.start_time.split('T')[1] // "15:00:00.000Z"

                // 3. Combine Original Date + New Time
                const newMasterStart = `${masterDateStr}T${newTimePart}`
                finalUpdates.start_time = newMasterStart

                // 4. Handle End Time (preserve duration or use new time?)
                // If we also have an end time, we should calculate the duration of the *updated instance*
                // and apply it to the new master start.
                if (updates.end_time) {
                    const updateStart = new Date(updates.start_time).getTime()
                    const updateEnd = new Date(updates.end_time).getTime()
                    const duration = updateEnd - updateStart

                    const newMasterStartMs = new Date(newMasterStart).getTime()
                    const newMasterEnd = new Date(newMasterStartMs + duration).toISOString()
                    finalUpdates.end_time = newMasterEnd
                } else {
                    // If no end time in update, but master had one? 
                    // Usually updates come in pairs. If not, we might lose duration if we don't recalc.
                    // But assume safe if updates is partial.
                    // If master had end_time, we should probably shift it too?
                    if (task.end_time && task.start_time) {
                        const oldDuration = new Date(task.end_time).getTime() - new Date(task.start_time).getTime()
                        const newMasterStartMs = new Date(newMasterStart).getTime()
                        finalUpdates.end_time = new Date(newMasterStartMs + oldDuration).toISOString()
                    }
                }

                // 5. Ensure due_date matches the Original Date (Time changes shouldn't move the date)
                finalUpdates.due_date = masterDateStr

                // 6. Update the RRULE's DTSTART to match the new time
                // This ensures the pattern generation starts at the correct time of day
                const newStartObj = new Date(newMasterStart)
                newRule = updateDTStartInRRule(task.recurrence_rule || '', newStartObj)
            }
            else {
                // If NO start_time (e.g. all-day move), the user said "Date changes will be later".
                // So we STRIP due_date changes if they try to move it to another day.
                // We only allow title/description/priority updates here.
                if (finalUpdates.due_date && finalUpdates.due_date !== task.due_date) {
                    delete finalUpdates.due_date
                }
            }

            // Always update rule
            finalUpdates.recurrence_rule = newRule

            await updateTask({
                taskId: task.id,
                updates: finalUpdates
            })
        }
    }

    return { confirmRecurrenceUpdate }
}
