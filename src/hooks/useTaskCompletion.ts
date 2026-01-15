import { useState, useCallback } from 'react'
import { useTaskOccurrence } from './useTaskOccurrence'
import { useUpdateTask } from './useUpdateTask'
import { getPastIncompleteInstances } from '@/utils/recurrence'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

export function useTaskCompletion() {
    const { setOccurrenceStatus, removeOccurrence, batchSetOccurrenceStatus } = useTaskOccurrence()
    const { mutate: updateTask } = useUpdateTask()

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [pendingContext, setPendingContext] = useState<{
        task: Task,
        date: string
    } | null>(null)
    const [pastInstances, setPastInstances] = useState<string[]>([])

    const toggleStatus = useCallback(async (task: Task, date?: string, occurrencesMap?: Record<string, string>) => {
        // If task is virtual, we expect `date` to be passed (e.g. from TaskItem or DailyPlanner logic)
        let actualDate = date
        let isVirtual = !!date
        const realId = task.id.split('_recur_')[0] || task.id

        const currentCompleted = task.is_completed

        if (currentCompleted) {
            // UN-COMPLETE
            if (isVirtual && actualDate) {
                removeOccurrence({ taskId: realId, date: actualDate })
            } else {
                updateTask({ taskId: task.id, updates: { is_completed: false } })
            }
        } else {
            // COMPLETE
            if (isVirtual && actualDate) {
                let map = occurrencesMap

                // If map not provided, fetch all occurrences for this task to check history
                if (!map) {
                    const { data, error } = await supabase
                        .from('task_occurrences')
                        .select('*')
                        .eq('task_id', realId)

                    if (!error && data) {
                        map = {}
                        data.forEach((o: any) => {
                            map![`${o.task_id}_${o.original_date.split('T')[0]}`] = o.status
                        })
                    }
                }

                // Find past incomplete instances
                const past = getPastIncompleteInstances(task, map || {})
                if (past.length > 0) {
                    setPastInstances(past)
                    setPendingContext({ task, date: actualDate })
                    setIsModalOpen(true)
                    return // Delay completion until modal confirm
                }
                setOccurrenceStatus({ taskId: realId, date: actualDate, status: 'completed' })
            } else {
                updateTask({ taskId: task.id, updates: { is_completed: true } })
            }
        }
    }, [removeOccurrence, setOccurrenceStatus, updateTask])

    const handleConfirmPast = useCallback((mode: 'all_completed' | 'all_skipped' | 'just_this') => {
        if (!pendingContext) return
        const { task, date } = pendingContext
        const realId = task.id.split('_recur_')[0] || task.id

        // 1. Complete this instance
        setOccurrenceStatus({ taskId: realId, date, status: 'completed' })

        // 2. Handle past instances
        if (mode === 'all_completed') {
            batchSetOccurrenceStatus({ taskId: realId, dates: pastInstances, status: 'completed' })
        } else if (mode === 'all_skipped') {
            batchSetOccurrenceStatus({ taskId: realId, dates: pastInstances, status: 'skipped' })
        }

        setIsModalOpen(false)
        setPendingContext(null)
        setPastInstances([])
    }, [pendingContext, pastInstances, setOccurrenceStatus, batchSetOccurrenceStatus])

    return {
        toggleStatus,
        isModalOpen,
        setIsModalOpen,
        pastInstances,
        handleConfirmPast
    }
}
