import React from 'react'
import { Calendar, ArrowRight, SkipForward, FolderInput, Trash2, Unlink, Copy, Flag } from 'lucide-react'
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
        {
            type: 'custom' as const,
            content: (
                <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                    {[
                        { id: 'high', label: 'High', color: 'text-red-500', hover: 'hover:bg-red-50' },
                        { id: 'medium', label: 'Medium', color: 'text-amber-500', hover: 'hover:bg-amber-50' },
                        { id: 'low', label: 'Low', color: 'text-blue-500', hover: 'hover:bg-blue-50' },
                        { id: 'none', label: 'Normal', color: 'text-gray-400', hover: 'hover:bg-gray-50' }
                    ].map((p) => (
                        <button
                            key={p.id}
                            onClick={(e) => {
                                e.stopPropagation()
                                updateTask({ taskId, updates: { priority: (p.id === 'none' ? null : p.id) as any } })
                                if (showToasts) toast.success(`Priority set to ${p.label}`)
                                // Determine if we should close the menu? Context menus usually close on action.
                                // But since this is a custom row, I need to ensure it closes.
                                // However, I don't have direct access to 'onClose' here unless I pass it or handle it.
                                // But ContextMenu.tsx handles close on item click. 
                                // Since this is a custom content button, the ContextMenu wrapping click handler won't fire automatically for inner buttons if I stop propagation.
                                // If I don't stop propagation, it might work?
                                // Let's check ContextMenu.tsx again:
                                // Custom item just renders content. It doesn't wrap in a button/onclick handler like standard items.
                                // So I need to manually close it? 
                                // useTaskMenu returns items, it doesn't receive onClose control directly to pass to items?
                                // Actually, ContextMenu.tsx passes `onClose` to MenuItem, but `MenuItem` for custom type just renders content.
                                // So my custom content cannot easily close the menu unless I pass a way to do so.
                                // But I can dispatch a click or something?
                                // Or better: The definition of useTaskMenu doesn't seem to include a way to close the menu.
                                // Ah, standard items have `onClick` which `ContextMenu` calls then closes.
                                // For custom items, I might need to dispatch a global click or escape?
                                // Or I can trigger a re-render that closes it?
                                // Wait, `onClose` is passed to `MenuItem`. But `MenuItem` uses it for standard items.
                                // I cannot access `onClose` inside the definition of `menuItems` in `useTaskMenu` because `useTaskMenu` is a hook that returns data.
                                // It doesn't know about the UI state of the menu (open/closed) except via `onSkipOccurrence` callback which seems to be a hack.

                                // User request: "Add icons...". 
                                // If I can't close the menu, it's a bit annoying.
                                // Maybe I can fire a click on document? `document.body.click()`?
                                // That would trigger `handleClickOutside` in ContextMenu... which closes it!
                                document.body.click()
                            }}
                            className={clsx(
                                "p-1.5 rounded-md transition-colors flex-1 flex justify-center",
                                p.hover,
                                task.priority === (p.id === 'none' ? null : p.id) ? "bg-gray-100 ring-1 ring-gray-200" : ""
                            )}
                            title={p.label}
                        >
                            <Flag size={16} className={clsx(p.color, task.priority === (p.id === 'none' ? null : p.id) && "fill-current")} />
                        </button>
                    ))}
                </div>
            )
        },
        { type: 'separator' as const },
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
