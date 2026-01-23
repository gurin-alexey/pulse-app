import React from 'react'
import { Flag, FolderInput, Unlink, Copy, Trash2, Check, Circle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'

import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useCreateTask } from '@/hooks/useCreateTask'
import { useDeleteTask } from '@/hooks/useDeleteTask'
import { useSettings } from '@/store/useSettings'
import type { ContextMenuItem } from '@/shared/components/ContextMenu'
import type { Task } from '@/types/database'
import { PRIORITIES } from '@/constants/priorities'

interface UseCalendarContextMenuProps {
    task: Task | null
    onClose: () => void
    onDeleteRecurring?: () => void // For recurring tasks, open special modal
}

export function useCalendarContextMenu({
    task,
    onClose,
    onDeleteRecurring
}: UseCalendarContextMenuProps): ContextMenuItem[] {
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createTask } = useCreateTask()
    const { mutate: deleteTask } = useDeleteTask()
    const { settings } = useSettings()

    const showToasts = settings?.preferences.show_toast_hints !== false

    if (!task) return []

    const taskId = task.id.includes('_recur_') ? task.id.split('_recur_')[0] : task.id

    const menuItems: ContextMenuItem[] = [
        // Priority row
        {
            type: 'custom',
            content: (
                <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                    {PRIORITIES.map((p) => (
                        <button
                            key={p.id}
                            onClick={(e) => {
                                e.stopPropagation()
                                updateTask({ taskId, updates: { priority: p.value as any } })
                                if (showToasts) toast.success(`Приоритет: ${p.label}`)
                                onClose()
                            }}
                            className={clsx(
                                "p-1.5 rounded-md transition-colors flex-1 flex justify-center",
                                p.colors.hover,
                                task?.priority === p.value ? "bg-gray-100 ring-1 ring-gray-200" : ""
                            )}
                            title={p.label}
                        >
                            <Flag size={16} className={clsx(p.colors.text, task?.priority === p.value && p.colors.fill)} />
                        </button>
                    ))}
                </div>
            )
        },
        { type: 'separator' },

        // Toggle completed
        {
            label: task?.is_completed ? 'Не выполнено' : 'Выполнено',
            icon: task?.is_completed
                ? <Circle size={14} className="text-gray-500" />
                : <CheckCircle2 size={14} className="text-green-500" />,
            onClick: () => {
                updateTask({ taskId, updates: { is_completed: !task?.is_completed } })
                if (showToasts) {
                    toast.success(task?.is_completed ? "Задача возвращена" : "Задача выполнена")
                }
                onClose()
            }
        },

        { type: 'separator' },

        // Add to project
        {
            label: 'Добавить в проект',
            icon: <FolderInput size={14} className="text-gray-500" />,
            onClick: () => {
                window.dispatchEvent(new CustomEvent('open-move-task-search', { detail: taskId }))
                onClose()
            }
        },

        // Make standalone (only if has parent)
        ...(task?.parent_id ? [{
            label: 'Сделать самостоятельной',
            icon: <Unlink size={14} className="text-gray-500" />,
            onClick: () => {
                updateTask({ taskId, updates: { parent_id: null } })
                if (showToasts) toast.success("Задача стала самостоятельной")
                onClose()
            }
        }] : []),

        { type: 'separator' },

        // Duplicate
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
                    // Don't copy recurrence_rule for duplicates
                })
                if (showToasts) toast.success("Задача дублирована")
                onClose()
            }
        },

        { type: 'separator' },

        // Delete
        {
            label: 'Удалить',
            icon: <Trash2 size={14} />,
            variant: 'danger',
            onClick: () => {
                if (task?.recurrence_rule && onDeleteRecurring) {
                    onDeleteRecurring()
                } else {
                    deleteTask(taskId)
                    if (showToasts) toast.success("Задача удалена")
                }
                onClose()
            }
        }
    ]

    return menuItems
}
