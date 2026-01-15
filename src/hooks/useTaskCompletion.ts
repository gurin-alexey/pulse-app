import { useState, useCallback } from 'react'
import { useTaskOccurrence } from './useTaskOccurrence'
import { useUpdateTask } from './useUpdateTask'
import { useCreateTask } from './useCreateTask'
import { toast } from 'sonner'
import { getNextOccurrenceDate, updateDTStartInRRule } from '@/utils/recurrence'
import type { Task } from '@/types/database'
import { useSearchParams } from 'react-router-dom'

export function useTaskCompletion() {
    const { removeOccurrence, setOccurrenceStatus } = useTaskOccurrence()
    const { mutateAsync: updateTask } = useUpdateTask()
    const { mutateAsync: createTask } = useCreateTask()
    const [searchParams, setSearchParams] = useSearchParams()

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [pendingContext, setPendingContext] = useState<{
        task: Task,
        date: string
    } | null>(null)
    const [pastInstances, setPastInstances] = useState<string[]>([])

    const toggleStatus = useCallback(async (task: Task, date?: string, occurrencesMap?: Record<string, string>) => {
        const actualDate = date
        const isVirtual = !!date
        const realId = task.id.split('_recur_')[0] || task.id
        const currentCompleted = task.is_completed

        if (currentCompleted) {
            // UN-COMPLETE
            if (isVirtual && actualDate) {
                // If it was a virtual occurrence, we shouldn't really be here 
                // because virtual occurrences in the new model are separate real tasks once completed.
                // But for backward compatibility with existing task_occurrences:
                removeOccurrence({ taskId: realId, date: actualDate })
            } else {
                await updateTask({ taskId: task.id, updates: { is_completed: false, completed_at: null } })
                toast.info("Задача возвращена в работу")
            }
        } else {
            // COMPLETE
            if (task.recurrence_rule) {
                /* 
                // ВРЕМЕННО ОТКЛЮЧЕНО: Проверка пропущенных повторов
                const past = getPastIncompleteInstances(task, occurrencesMap || {})
                if (past.length > 0) {
                    setPastInstances(past)
                    setPendingContext({ task, date: actualDate || task.due_date || '' })
                    setIsModalOpen(true)
                    return 
                }
                */

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
                    completionObj = task.start_time ? new Date(task.start_time) : (task.due_date ? new Date(task.due_date + 'T00:00:00') : new Date())
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

                    const newRule = updateDTStartInRRule(task.recurrence_rule, nextDate)

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
            } else {
                // Обычная задача
                await updateTask({ taskId: task.id, updates: { is_completed: true, completed_at: new Date().toISOString() } })
                toast.success("Задача выполнена")
            }
        }
    }, [removeOccurrence, updateTask, createTask])

    const handleConfirmPast = useCallback((mode: 'all_completed' | 'all_skipped' | 'just_this') => {
        // Заглушка, так как функционал временно отключен
        setIsModalOpen(false)
        setPendingContext(null)
        setPastInstances([])
    }, [])

    return {
        toggleStatus,
        isModalOpen,
        setIsModalOpen,
        pastInstances,
        handleConfirmPast
    }
}
