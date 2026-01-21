import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTaskOccurrence } from './useTaskOccurrence'
import { useUpdateTask } from './useUpdateTask'
import { useCreateTask } from './useCreateTask'
import { toast } from 'sonner'
import { getNextOccurrenceDate, updateDTStartInRRule, getPastIncompleteInstances } from '@/utils/recurrence'
import type { Task } from '@/types/database'
import type { TaskWithTags } from './useTasks'

export function useTaskCompletion() {
    const queryClient = useQueryClient()
    const { removeOccurrence, batchSetOccurrenceStatus } = useTaskOccurrence()
    const { mutateAsync: updateTask } = useUpdateTask()
    const { mutateAsync: createTask } = useCreateTask()

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [pendingContext, setPendingContext] = useState<{
        task: Task,
        date: string | undefined
    } | null>(null)
    const [pastInstances, setPastInstances] = useState<string[]>([])

    // Helper for safe cache updates (supports both Array and Object with tasks prop)
    const safeUpdateCache = useCallback((queryKeyString: string, updater: (tasks: any[]) => any[]) => {
        const queries = queryClient.getQueriesData({ queryKey: [queryKeyString] })
        queries.forEach(([key, oldData]) => {
            if (!oldData) return

            if (Array.isArray(oldData)) {
                queryClient.setQueryData(key, updater(oldData))
            } else if ((oldData as any).tasks && Array.isArray((oldData as any).tasks)) {
                queryClient.setQueryData(key, { ...oldData, tasks: updater((oldData as any).tasks) })
            }
        })
    }, [queryClient])

    const executeCompletion = useCallback(async (task: Task, date: string | undefined) => {
        const actualDate = date
        const isVirtual = !!date
        const realId = task.id.split('_recur_')[0] || task.id

        // Логика "Complete & Fork": 
        // 1. Текущий мастер завершается (recurrence_rule = null)
        // 2. Создаётся НОВЫЙ мастер со следующего повторения

        // 1. Находим дату завершаемого экземпляра
        let currentOccurrenceDate: string
        let completionObj: Date
        if (isVirtual && actualDate) {
            currentOccurrenceDate = actualDate.split('T')[0] // Только дата
            completionObj = new Date(currentOccurrenceDate + 'T00:00:00')
            if (task.start_time) {
                const timePart = task.start_time.split('T')[1]?.split('+')[0]?.split('Z')[0] || '00:00:00'
                completionObj = new Date(`${currentOccurrenceDate}T${timePart}`)
            }
        } else {
            // Извлекаем только часть даты (первые 10 символов) из due_date
            const rawDueDate = task.due_date || new Date().toISOString()
            currentOccurrenceDate = rawDueDate.includes('T')
                ? rawDueDate.split('T')[0]
                : rawDueDate.slice(0, 10)

            if (task.start_time) {
                const timePart = task.start_time.split('T')[1]?.split('+')[0]?.split('Z')[0] || '00:00:00'
                completionObj = new Date(`${currentOccurrenceDate}T${timePart}`)
            } else {
                completionObj = new Date(`${currentOccurrenceDate}T00:00:00`)
            }
        }

        // Проверка валидности даты
        if (isNaN(completionObj.getTime())) {
            toast.error("Ошибка: невалидная дата")
            return
        }

        // 2. Рассчитываем следующую дату для НОВОЙ серии
        // Используем конец текущего дня чтобы получить СЛЕДУЮЩЕЕ вхождение
        const endOfCurrentDay = new Date(currentOccurrenceDate + 'T23:59:59')
        const nextDate = getNextOccurrenceDate(task, endOfCurrentDay)

        // 3. ATOMIC OPTIMISTIC UPDATE: Готовим данные и обновляем кэш ОДИН раз
        let newMaster: Task | null = null

        if (nextDate) {
            const nextDateStr = nextDate.toISOString().split('T')[0]
            let nextStartTime: string | null = null
            let nextEndTime: string | null = null

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

            // Генерируем ID
            const tempId = crypto.randomUUID()
            const nowIso = new Date().toISOString()

            // Данные новой задачи (Optimistic)
            const optimisticNewMaster: TaskWithTags = {
                ...task,
                id: tempId,
                due_date: nextDateStr,
                start_time: nextStartTime,
                end_time: nextEndTime,
                recurrence_rule: newRule,
                is_completed: false,
                completed_at: null,
                created_at: nowIso,
                deleted_at: null,
                is_project: false,
                subtasks_count: 0,
                tags: (task as any).tags || []
            }

            // Данные обновления старой задачи (Optimistic)
            const oldTaskUpdates = {
                due_date: currentOccurrenceDate,
                start_time: (isVirtual && actualDate && task.start_time)
                    ? `${actualDate}T${task.start_time.split('T')[1]}`
                    : task.start_time,
                end_time: (isVirtual && actualDate && task.end_time)
                    ? `${actualDate}T${task.end_time.split('T')[1]}`
                    : task.end_time,
                recurrence_rule: null,
                is_completed: true,
                completed_at: nowIso
            }

            // Функция атомарного обновления списка
            const atomicUpdater = (oldList: any[]) => {
                let updatedList = [...oldList]

                // 1. Обновляем старую задачу (она исчезнет из календаря/списка на сегодня или станет галочкой)
                updatedList = updatedList.map(t => {
                    if (t.id === realId) {
                        return { ...t, ...oldTaskUpdates, tags: (t.tags || []) }
                    }
                    return t
                })

                // 2. Добавляем новую задачу (она появится на завтра)
                // Проверяем на дубликаты на всякий случай
                if (!updatedList.some(t => t.id === tempId)) {
                    updatedList = [optimisticNewMaster, ...updatedList]
                }

                return updatedList
            }

            // ПРИМЕНЯЕМ АТОМАРНОЕ ОБНОВЛЕНИЕ
            safeUpdateCache('tasks', atomicUpdater)
            safeUpdateCache('all-tasks-v2', atomicUpdater)

            try {
                // 4. Реальные запросы к серверу (без optimistic update хуков)

                // Сначала создаём новую (чтобы гарантировать сохранение серии)
                newMaster = await createTask({
                    id: tempId,
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    projectId: task.project_id,
                    userId: task.user_id,
                    parentId: task.parent_id,
                    due_date: nextDateStr,
                    start_time: nextStartTime,
                    end_time: nextEndTime,
                    recurrence_rule: newRule,
                    is_completed: false,
                    skipInvalidation: true,
                    skipOptimisticUpdate: true // <--- Важно!
                })

                // Потом завершаем старую
                const updatedOldMaster = await updateTask({
                    taskId: realId,
                    updates: oldTaskUpdates,
                    skipInvalidation: true,
                    skipOptimisticUpdate: true // <--- Важно!
                })

                // 5. MANUAL CACHE SYNC (обновляем реальные данные с сервера)
                const syncCache = (list: any[]) => {
                    return list.map(t => {
                        // Обновляем старую задачу (синхронизируем)
                        if (t.id === realId) {
                            return { ...t, ...updatedOldMaster, tags: (t.tags || []) }
                        }
                        // Обновляем новую задачу (синхронизируем)
                        if (newMaster && t.id === newMaster.id) {
                            return { ...newMaster, tags: (t.tags || []) }
                        }
                        return t
                    })
                }

                safeUpdateCache('tasks', syncCache)
                safeUpdateCache('all-tasks-v2', syncCache)

            } catch (err) {
                console.error('[useTaskCompletion] Failed during atomic completion:', err)
                toast.error("Ошибка при завершении повторяющейся задачи")

                // Rollback: просто сбрасываем кэш, так как ручной откат сложный
                queryClient.invalidateQueries({ queryKey: ['tasks'] })
                queryClient.invalidateQueries({ queryKey: ['all-tasks-v2'] })
            }
        }
        // Если nextDate нет (последний повтор?), просто завершаем
        else {
            // Fallback for non-recurring or last instance logic (simplified)
            try {
                await updateTask({
                    taskId: realId,
                    updates: {
                        is_completed: true,
                        completed_at: new Date().toISOString(),
                        recurrence_rule: null
                    },
                    // Здесь можно оставить стандартное поведение или too atomic
                })
            } catch (e) { console.error(e) }
        }

    }, [createTask, updateTask, safeUpdateCache, queryClient])

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
                const rawDateStr = actualDate || task.due_date || new Date().toISOString()
                const curDateStr = rawDateStr.includes('T') ? rawDateStr.split('T')[0] : rawDateStr.slice(0, 10)
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
