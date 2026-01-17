import { useState, useCallback } from 'react'
import { useTaskOccurrence } from './useTaskOccurrence'
import { useUpdateTask } from './useUpdateTask'
import { useCreateTask } from './useCreateTask'
import { toast } from 'sonner'
import { getNextOccurrenceDate, updateDTStartInRRule, getPastIncompleteInstances } from '@/utils/recurrence'
import type { Task } from '@/types/database'
import { useSearchParams } from 'react-router-dom'

export function useTaskCompletion() {
    const { removeOccurrence, setOccurrenceStatus, batchSetOccurrenceStatus } = useTaskOccurrence()
    const { mutateAsync: updateTask } = useUpdateTask()
    const { mutateAsync: createTask } = useCreateTask()
    const [searchParams, setSearchParams] = useSearchParams()

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [pendingContext, setPendingContext] = useState<{
        task: Task,
        date: string | undefined
    } | null>(null)
    const [pastInstances, setPastInstances] = useState<string[]>([])

    const executeCompletion = useCallback(async (task: Task, date: string | undefined) => {
        const actualDate = date
        const isVirtual = !!date
        const realId = task.id.split('_recur_')[0] || task.id

        // Новая логика: Advance via Mutation (Master moves forward, Clone stays back as completed)
        // 1. Находим дату завершаемого экземпляра
        let currentOccurrenceDate: string
        let completionObj: Date
        if (isVirtual && actualDate) {
            currentOccurrenceDate = actualDate
            completionObj = new Date(actualDate + 'T00:00:00')
            if (task.start_time) {
                const timePart = task.start_time.split('T')[1] || '00:00:00'
                completionObj = new Date(`${actualDate}T${timePart}`)
            }
        } else {
            currentOccurrenceDate = task.due_date || new Date().toISOString().split('T')[0]
            // Fix: Use currentOccurrenceDate as the base for completionObj to avoid issues with stale start_time dates
            if (task.start_time) {
                const timePart = task.start_time.split('T')[1] || '00:00:00'
                completionObj = new Date(`${currentOccurrenceDate}T${timePart}`)
            } else {
                completionObj = new Date(`${currentOccurrenceDate}T00:00:00`)
            }
        }

        // 2. Рассчитываем следующую дату для МАСТЕРА
        const nextDate = getNextOccurrenceDate(task, completionObj)

        // 3. Создаем ВЫПОЛНЕННЫЙ КЛОН текущего вхождения
        const newClone = await createTask({
            title: task.title,
            description: task.description,
            priority: task.priority,
            projectId: task.project_id,
            userId: task.user_id,
            parentId: task.parent_id,
            due_date: currentOccurrenceDate,
            start_time: (isVirtual && actualDate && task.start_time) ? `${actualDate}T${task.start_time.split('T')[1]}` : task.start_time,
            end_time: (isVirtual && actualDate && task.end_time) ? `${actualDate}T${task.end_time.split('T')[1]}` : task.end_time,
            recurrence_rule: null, // Клон не повторяется
            is_completed: true,
            completed_at: new Date().toISOString()
        } as any)

        // 4. Помечаем вхождение мастера как завершенное (скрываем его)
        await setOccurrenceStatus({
            taskId: realId,
            date: currentOccurrenceDate,
            status: 'completed'
        })

        toast.success("Задача выполнена")

        // 5. Если текущая открытая задача в URL совпадает с этой - переключаем на клон
        const currentTaskInUrl = searchParams.get('task')
        const virtualId = `${realId}_recur_${actualDate}`
        if (currentTaskInUrl === realId || currentTaskInUrl === virtualId) {
            const newParams = new URLSearchParams(searchParams)
            newParams.set('task', newClone.id)
            newParams.delete('occurrence')
            setSearchParams(newParams, { replace: true })
        }

        if (nextDate) {
            // 6. Продвигаем ОРИГИНАЛЬНОГО МАСТЕРА на будущее (сохраняя ID)
            const nextDateStr = nextDate.toISOString().split('T')[0]
            let nextStartTime = null
            let nextEndTime = null

            if (task.start_time) {
                const timePart = task.start_time.split('T')[1]
                nextStartTime = `${nextDateStr}T${timePart}`

                if (task.end_time) {
                    const startMs = new Date(task.start_time).getTime()
                    const endMs = new Date(task.end_time).getTime()
                    const duration = endMs - startMs
                    nextEndTime = new Date(new Date(nextStartTime).getTime() + duration).toISOString()
                }
            }

            const newRule = updateDTStartInRRule(task.recurrence_rule || '', nextDate)

            await updateTask({
                taskId: realId,
                updates: {
                    due_date: nextDateStr,
                    start_time: nextStartTime,
                    end_time: nextEndTime,
                    recurrence_rule: newRule,
                    is_completed: false, // Мастер остается активным
                    completed_at: null
                }
            })
        } else {
            // Если повторов больше нет, просто завершаем мастера
            await updateTask({
                taskId: realId,
                updates: {
                    is_completed: true,
                    completed_at: new Date().toISOString(),
                    recurrence_rule: null
                }
            })
        }
    }, [createTask, setOccurrenceStatus, searchParams, setSearchParams, updateTask])

    const toggleStatus = useCallback(async (task: Task, date?: string, occurrencesMap?: Record<string, string>) => {
        const actualDate = date
        const isVirtual = !!date
        const realId = task.id.split('_recur_')[0] || task.id
        const currentCompleted = task.is_completed

        if (currentCompleted) {
            // UN-COMPLETE
            if (isVirtual && actualDate) {
                removeOccurrence({ taskId: realId, date: actualDate })
            } else {
                await updateTask({ taskId: task.id, updates: { is_completed: false, completed_at: null } })
                toast.info("Задача возвращена в работу")
            }
        } else {
            // COMPLETE
            if (task.recurrence_rule) {
                // Ensure we have the occurrences map to avoid false positives
                let map = occurrencesMap
                if (!map) {
                    const { data } = await import('@/lib/supabase').then(m => m.supabase.from('task_occurrences').select('original_date, status').eq('task_id', realId))
                    if (data) {
                        map = {}
                        data.forEach((o: any) => {
                            // Correct key format expected by getPastIncompleteInstances
                            // logic in recurrence.ts uses: `${task.id}_${dateStr}`
                            // recurrence.ts lines 229: const lookupKey = `${task.id}_${dateStr}`
                            if (map) map[`${realId}_${o.original_date}`] = o.status
                        })
                    }
                }

                // Проверка пропущенных повторов
                // We pass the current instance's date as the reference date so we only look for instances strictly BEFORE this one.
                const curDateStr = actualDate || task.due_date || new Date().toISOString().split('T')[0]
                const referenceObj = new Date(curDateStr + 'T00:00:00')

                const past = getPastIncompleteInstances(task, map || {}, referenceObj)

                // Exclude the current instance if it is being completed (double safety)
                const filteredPast = past.filter(d => d !== curDateStr)

                if (filteredPast.length > 0) {
                    setPastInstances(filteredPast)
                    setPendingContext({ task, date: actualDate })
                    setIsModalOpen(true)
                    return
                }

                await executeCompletion(task, actualDate)
            } else {
                await updateTask({ taskId: task.id, updates: { is_completed: true, completed_at: new Date().toISOString() } })
                toast.success("Задача выполнена")
            }
        }
    }, [removeOccurrence, updateTask, executeCompletion])

    const handleConfirmPast = useCallback(async (decisions: Record<string, 'completed' | 'skipped' | 'ignore'> | 'all_completed' | 'all_skipped' | 'just_this') => {
        if (!pendingContext) return

        const realId = pendingContext.task.id.split('_recur_')[0] || pendingContext.task.id

        if (typeof decisions === 'string') {
            // Обработка старых режимов (или кнопок "всех")
            if (decisions === 'all_completed') {
                await batchSetOccurrenceStatus({ taskId: realId, dates: pastInstances, status: 'completed' })
            } else if (decisions === 'all_skipped') {
                await batchSetOccurrenceStatus({ taskId: realId, dates: pastInstances, status: 'skipped' })
            }
            // 'just_this' -> ничего не делаем с прошлыми
        } else {
            // Обработка поштучного выбора
            const completedDates: string[] = []
            const skippedDates: string[] = []

            Object.entries(decisions).forEach(([date, action]) => {
                if (action === 'completed') completedDates.push(date)
                if (action === 'skipped') skippedDates.push(date)
            })

            if (completedDates.length > 0) {
                await batchSetOccurrenceStatus({ taskId: realId, dates: completedDates, status: 'completed' })
            }

            if (skippedDates.length > 0) {
                await batchSetOccurrenceStatus({ taskId: realId, dates: skippedDates, status: 'skipped' })
            }
        }

        // Proceed with original completion
        await executeCompletion(pendingContext.task, pendingContext.date)

        setIsModalOpen(false)
        setPendingContext(null)
        setPastInstances([])
    }, [pendingContext, batchSetOccurrenceStatus, executeCompletion, pastInstances])

    return {
        toggleStatus,
        isModalOpen,
        setIsModalOpen,
        pastInstances,
        handleConfirmPast
    }
}
