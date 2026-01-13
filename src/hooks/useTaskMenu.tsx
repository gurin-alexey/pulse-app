import React from 'react'
import { Calendar, ArrowRight, SkipForward, FolderInput, Trash2, Unlink, Copy } from 'lucide-react'
import { format, startOfToday, addDays, nextMonday } from 'date-fns'
import { toast } from 'sonner'
import clsx from 'clsx'

import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useCreateTask } from '@/hooks/useCreateTask'
import { useSettings } from '@/store/useSettings'
import { useTaskOccurrence } from '@/hooks/useTaskOccurrence'

interface UseTaskMenuProps {
    task: any
    taskId: string // The real UUID
    // For virtual instances
    occurrenceDate?: string | null
    // Callbacks for UI actions that require modals
    onDateChangeRequest?: (dateStr: string) => void
    onDelete?: () => void
    onSkipOccurrence?: () => void
}

export function useTaskMenu({
    task,
    taskId,
    occurrenceDate,
    onDateChangeRequest,
    onDelete,
    onSkipOccurrence
}: UseTaskMenuProps) {
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createTask } = useCreateTask()
    const { settings } = useSettings()
    const { setOccurrenceStatus } = useTaskOccurrence()

    const showToasts = settings?.preferences.show_toast_hints !== false

    // Parsing virtual info if not passed explicitly, though purely relies on props
    const isVirtual = task?.id?.includes('_recur_')
    const finalOccurrenceDate = occurrenceDate || (isVirtual ? task.id.split('_recur_')[1] ? format(new Date(Number(task.id.split('_recur_')[1])), 'yyyy-MM-dd') : null : null)

    const handleDateAction = (date: Date, toastMsg: string) => {
        const dateStr = format(date, 'yyyy-MM-dd')

        if (task?.recurrence_rule) {
            if (onDateChangeRequest) {
                onDateChangeRequest(dateStr)
            }
        } else {
            updateTask({ taskId, updates: { due_date: dateStr } })
            if (showToasts) toast.success(toastMsg)
        }
    }

    const todayStr = format(startOfToday(), 'yyyy-MM-dd')
    const currentTaskDate = finalOccurrenceDate || task?.due_date

    const menuItems = [
        ...(currentTaskDate !== todayStr ? [{
            label: 'Сегодня',
            icon: <Calendar size={14} className="text-green-500" />,
            onClick: () => handleDateAction(startOfToday(), "📅 Перенесено на сегодня")
        }] : []),
        {
            label: 'Завтра',
            icon: <ArrowRight size={14} className="text-orange-500" />,
            onClick: () => handleDateAction(addDays(startOfToday(), 1), "📅 Перенесено на завтра")
        },
        {
            label: 'Ближайший понедельник',
            icon: <Calendar size={14} className="text-purple-500" />,
            onClick: () => handleDateAction(nextMonday(startOfToday()), "📅 Перенесено на понедельник")
        },
        // Recurring: Skip Occurrence
        ...(task?.recurrence_rule && finalOccurrenceDate ? [{
            label: 'Пропустить повтор',
            icon: <SkipForward size={14} className="text-gray-500" />,
            onClick: () => {
                // If callback provided, use it (e.g. to close modals)
                if (onSkipOccurrence) {
                    onSkipOccurrence()
                }

                // Perform the skip action
                // Using setOccurrenceStatus from hook
                setOccurrenceStatus({
                    taskId,
                    date: finalOccurrenceDate,
                    status: 'archived'
                })

                if (showToasts) toast.success("Повтор пропущен")
            }
        }] : []),

        { type: 'separator' as const },

        {
            label: 'Добавить в проект',
            icon: <FolderInput size={14} className="text-gray-500" />,
            onClick: () => {
                window.dispatchEvent(new CustomEvent('open-move-task-search', { detail: taskId }))
            }
        },
        ...(task?.parent_id ? [{
            label: 'Сделать самостоятельной',
            icon: <Unlink size={14} className="text-gray-500" />,
            onClick: () => {
                updateTask({ taskId, updates: { parent_id: null } })
                if (showToasts) toast.success("Задача стала самостоятельной")
            }
        }] : []),

        { type: 'separator' as const },

        {
            label: 'Дублировать',
            icon: <Copy size={14} className="text-gray-500" />,
            onClick: () => {
                createTask({
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    projectId: task.project_id,
                    userId: task.user_id,
                    parentId: task.parent_id,
                    sectionId: task.section_id,
                    due_date: task.due_date,
                    start_time: task.start_time,
                    end_time: task.end_time,
                    recurrence_rule: task.recurrence_rule
                })
                if (showToasts) toast.success("Задача дублирована")
            }
        },

        { type: 'separator' as const },

        {
            label: 'Удалить',
            icon: <Trash2 size={14} />,
            variant: 'danger' as const,
            onClick: () => {
                if (onDelete) {
                    onDelete()
                }
            }
        }
    ]

    return menuItems
}
