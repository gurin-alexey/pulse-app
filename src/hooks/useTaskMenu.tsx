import React from 'react'
import { Calendar, ArrowRight, SkipForward, FolderInput, Tag as TagIcon, Trash2 } from 'lucide-react'
import { format, startOfToday, addDays, nextMonday } from 'date-fns'
import { toast } from 'sonner'
import clsx from 'clsx'

import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useTags, useToggleTaskTag } from '@/hooks/useTags'
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
    const { mutate: toggleTag } = useToggleTaskTag()
    const { data: allTags } = useTags()
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

        { type: 'separator' as const },

        {
            label: 'Метки',
            icon: <TagIcon size={14} className="text-gray-400" />,
            submenu: allTags?.map((tag: any) => ({
                label: tag.name,
                icon: (
                    <div
                        className={clsx(
                            "w-2 h-2 rounded-full",
                            task?.tags?.some((t: any) => t.id === tag.id) ? "ring-2 ring-offset-2 ring-blue-400" : ""
                        )}
                        style={{ backgroundColor: tag.color }}
                    />
                ),
                onClick: () => toggleTag({
                    taskId: taskId,
                    tagId: tag.id,
                    isAttached: task?.tags?.some((t: any) => t.id === tag.id)
                })
            }))
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
