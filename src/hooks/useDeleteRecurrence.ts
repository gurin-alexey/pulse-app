import { useCallback } from 'react'
import { toast } from 'sonner'
import { useTaskOccurrence } from '@/hooks/useTaskOccurrence'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useDeleteTask } from '@/hooks/useDeleteTask'
import { addUntilToRRule } from '@/utils/recurrence'

interface UseDeleteRecurrenceProps {
    task: any
    taskId: string // Real UUID
    occurrenceDate: string | null
    onSuccess?: () => void
}

export function useDeleteRecurrence({ task, taskId, occurrenceDate, onSuccess }: UseDeleteRecurrenceProps) {
    const { setOccurrenceStatus } = useTaskOccurrence()
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: deleteTask } = useDeleteTask()

    const handleDeleteInstance = useCallback(() => {
        if (!occurrenceDate) return
        setOccurrenceStatus({
            taskId,
            date: occurrenceDate,
            status: 'archived'
        })
        toast.success("Occurrence deleted")
        onSuccess?.()
    }, [taskId, occurrenceDate, setOccurrenceStatus, onSuccess])

    const handleDeleteFuture = useCallback(() => {
        if (!task?.recurrence_rule || !occurrenceDate) return

        // Set until date to the end of the previous day (23:59:59)
        const untilDate = new Date(new Date(occurrenceDate).getTime() - 1000)
        const newRule = addUntilToRRule(task.recurrence_rule, untilDate)

        updateTask({ taskId, updates: { recurrence_rule: newRule } })
        toast.success("Future occurrences deleted")
        onSuccess?.()
    }, [task, taskId, occurrenceDate, updateTask, onSuccess])

    const handleDeleteAll = useCallback(() => {
        deleteTask(taskId)
        onSuccess?.()
    }, [taskId, deleteTask, onSuccess])

    return {
        handleDeleteInstance,
        handleDeleteFuture,
        handleDeleteAll
    }
}
