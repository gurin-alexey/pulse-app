import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { useTask } from '@/hooks/useTask'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useCreateTask } from '@/hooks/useCreateTask'
import { useRecurrenceUpdate } from '@/hooks/useRecurrenceUpdate'
import { addExDateToRRule } from '@/utils/recurrence'
import type { TaskWithTags } from '@/hooks/useTasks'

type UseTaskRecurrenceLogicProps = {
    taskId: string
    occurrenceDateProp?: string | null
}

export function useTaskRecurrenceLogic({ taskId, occurrenceDateProp }: UseTaskRecurrenceLogicProps) {
    const [searchParams, setSearchParams] = useSearchParams()

    // 1. Parse composite ID
    const isCompositeId = taskId.includes('_recur_')
    let realTaskId = taskId
    let embeddedDate: string | null = null

    if (isCompositeId) {
        const parts = taskId.split('_recur_')
        realTaskId = parts[0]
        const timestamp = Number(parts[1])
        if (!isNaN(timestamp)) {
            embeddedDate = format(new Date(timestamp), 'yyyy-MM-dd')
        }
    }

    // 2. Determine effective occurrence date
    // Priority: Prop -> URL param -> Embedded in ID
    const occurrenceDate = occurrenceDateProp ?? searchParams.get('occurrence') ?? embeddedDate
    const isVirtual = !!occurrenceDate
    const occurrenceDateStr = occurrenceDate || null

    // 3. States for Recurrence Edit Modal
    const [recurrenceEditModalOpen, setRecurrenceEditModalOpen] = useState(false)
    const [pendingDescription, setPendingDescription] = useState<string | null>(null)
    const [pendingDateUpdates, setPendingDateUpdates] = useState<Partial<TaskWithTags> | null>(null)
    const [recurrenceAction, setRecurrenceAction] = useState<'description' | 'date-time'>('description')
    const [allowedModes, setAllowedModes] = useState<('single' | 'following' | 'all')[] | undefined>(undefined)
    const [forcedOccurrenceDate, setForcedOccurrenceDate] = useState<string | null>(null)

    // Hooks needed for handlers
    const { data: task } = useTask(realTaskId)
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createTask } = useCreateTask()
    const { confirmRecurrenceUpdate } = useRecurrenceUpdate()

    // 4. Handlers

    const handleRecurrenceUpdateConfirm = async (mode: 'single' | 'following' | 'all') => {
        if (!task) return

        let updates: Partial<TaskWithTags> = {}

        if (recurrenceAction === 'description') {
            if (pendingDescription === null) return
            updates = { description: pendingDescription }
        } else if (recurrenceAction === 'date-time') {
            if (!pendingDateUpdates) return
            updates = pendingDateUpdates
        }

        const effectiveOccurrenceDate = occurrenceDateStr || forcedOccurrenceDate
        if (effectiveOccurrenceDate) {
            await confirmRecurrenceUpdate({
                task,
                mode,
                occurrenceDate: effectiveOccurrenceDate,
                updates
            })
        } else if (mode === 'all') {
            // Fallback for when we might edit the master task directly without occurrence context
            await confirmRecurrenceUpdate({
                task,
                mode,
                occurrenceDate: task.due_date || '', // Should not matter for 'all' mode
                updates
            })
        }

        setPendingDescription(null)
        setPendingDateUpdates(null)
        setForcedOccurrenceDate(null)
        setRecurrenceEditModalOpen(false)
    }

    const handleDetachInstance = () => {
        if (!task || !occurrenceDate) return

        const occDate = new Date(occurrenceDate as string)

        // 1. Update original task to exclude this date
        const newRule = addExDateToRRule(task.recurrence_rule || '', occDate)
        updateTask({ taskId: realTaskId, updates: { recurrence_rule: newRule } })

        // 2. Create new standalone task at the instance position
        const dateStr = format(occDate, 'yyyy-MM-dd')

        let endTime = null
        if (task.start_time && task.end_time) {
            const start = new Date(task.start_time)
            const end = new Date(task.end_time)
            const duration = end.getTime() - start.getTime()
            endTime = new Date(occDate.getTime() + duration).toISOString()
        }

        createTask({
            title: task.title,
            description: task.description,
            priority: task.priority,
            projectId: task.project_id,
            userId: task.user_id,
            due_date: dateStr,
            start_time: task.start_time ? occDate.toISOString() : null,
            end_time: endTime
        }, {
            onSuccess: (nt: any) => {
                setSearchParams({ task: nt.id })
            }
        })
    }

    return {
        // ID & Date Info
        isVirtual,
        realTaskId,
        occurrenceDate: occurrenceDateStr,

        // Modal States
        recurrenceEditModalOpen,
        setRecurrenceEditModalOpen,
        pendingDescription,
        setPendingDescription,
        pendingDateUpdates,
        setPendingDateUpdates,
        recurrenceAction,
        setRecurrenceAction,
        allowedModes,
        setAllowedModes,
        forcedOccurrenceDate,
        setForcedOccurrenceDate,

        // Handlers
        handleRecurrenceUpdateConfirm,
        handleDetachInstance
    }
}
