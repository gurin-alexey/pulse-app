import { useEffect, useState, useRef, Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import TextareaAutosize from 'react-textarea-autosize'
import { useTask } from '@/hooks/useTask'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useCreateTask } from '@/hooks/useCreateTask'
import { useDeleteTask } from '@/hooks/useDeleteTask'
import { toast } from 'sonner'
import { ContextMenu } from '@/shared/components/ContextMenu'
import { useTags, useToggleTaskTag } from '@/hooks/useTags'
import { X, Loader2, CheckSquare, Square, Trash2, Calendar as CalendarIcon, ChevronRight, ArrowUp, Flag, Repeat, MoreHorizontal, Tag as TagIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { SubtaskList } from './SubtaskList'
import { TagManager } from '../tags/TagManager'
import { ProjectPicker } from './ProjectPicker'
import { useTaskDateHotkeys } from '@/hooks/useTaskDateHotkeys'
import { DatePickerPopover } from '@/components/ui/date-picker/DatePickerPopover'
import { format } from 'date-fns'
import { addExDateToRRule } from '@/utils/recurrence'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { useTrashActions } from '@/hooks/useTrashActions'
import { useSettings } from '@/store/useSettings'

type TaskDetailProps = {
    taskId: string
}

export function TaskDetail({ taskId }: TaskDetailProps) {
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: task, isLoading } = useTask(taskId)
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createTask } = useCreateTask()
    const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask()
    const { restoreTask } = useTrashActions()
    const { settings } = useSettings()

    const showToasts = settings?.preferences.show_toast_hints !== false


    // Context Menu State (Moved up)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)
    const { mutate: toggleTag } = useToggleTaskTag()
    const { data: allTags } = useTags()

    // Breadcrumb Data
    const { data: parentTask } = useTask(task?.parent_id || '')

    // Enable hotkeys for this active task
    useTaskDateHotkeys(taskId, !!task)

    // Local state for auto-save inputs
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')

    // Instance handling (for recurrence)
    const occurrence = searchParams.get('occurrence')

    // Sync local state when task loads
    useEffect(() => {
        if (task) {
            setTitle(task.title || '')
            setDescription(task.description || '')
        }
    }, [task])

    // Keep track of values for unmount check
    const titleRef = useRef(title)
    const descriptionRef = useRef(description)

    // Track if this was opened as a new task
    const isNew = searchParams.get('isNew') === 'true'
    const isNewRef = useRef(isNew)

    useEffect(() => {
        titleRef.current = title
        descriptionRef.current = description
    }, [title, description])

    // Cleanup empty new tasks on unmount
    useEffect(() => {
        return () => {
            const currentParams = new URLSearchParams(window.location.search)
            // If the URL param 'task' is gone, we are effectively closing the view
            // OR if we are in a popup (DailyPlanner) and unmounting, we also want to check logic
            // But relying on URL for popup validity is tricky. 
            // However, the CRITICAL fix is checking isNewRef.

            const closing = !currentParams.get('task')
            const isEmpty = !titleRef.current.trim() && !descriptionRef.current.trim()

            // Only delete if it was explicitly marked as NEW and is empty
            if (closing && isEmpty && isNewRef.current) {
                deleteTask(taskId)
            }
        }
    }, [taskId])

    const handleClose = () => {
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('task')
        newParams.delete('isNew')
        newParams.delete('occurrence')
        setSearchParams(newParams)
    }

    const handleTitleBlur = () => {
        if (!task) return

        if (title !== task.title) {
            updateTask({ taskId, updates: { title } })
        }
    }

    const handleDescriptionBlur = () => {
        if (task && description !== task.description) {
            updateTask({ taskId, updates: { description } })
        }
    }

    const toggleStatus = () => {
        if (!task) return
        updateTask({ taskId, updates: { is_completed: !task.is_completed } })
    }

    const handleDelete = () => {
        deleteTask(taskId)
        if (showToasts) {
            toast.message("Задача удалена", {
                description: "Вы можете найти её в корзине",
                duration: 4000,
                action: {
                    label: 'Отменить',
                    onClick: () => restoreTask.mutate(taskId)
                }
            })
        }
    }

    const handleDetachInstance = () => {
        if (!task || !occurrence) return

        const occDate = new Date(occurrence as string)

        // 1. Update original task to exclude this date
        const newRule = addExDateToRRule(task.recurrence_rule || '', occDate)
        updateTask({ taskId, updates: { recurrence_rule: newRule } })

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

    const handleBreadcrumbClick = () => {
        if (task?.parent_id) {
            setSearchParams({ task: task.parent_id })
        }
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY })
    }

    const menuItems = [
        {
            label: 'Сегодня',
            icon: <CalendarIcon size={14} className="text-green-500" />,
            onClick: () => {
                const dateStr = format(new Date(), 'yyyy-MM-dd')
                updateTask({ taskId, updates: { due_date: dateStr } })
                if (showToasts) toast.success("📅 Set to Today")
            }
        },
        {
            label: 'Завтра',
            icon: <CalendarIcon size={14} className="text-orange-500" />,
            onClick: () => {
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)
                const dateStr = format(tomorrow, 'yyyy-MM-dd')
                updateTask({ taskId, updates: { due_date: dateStr } })
                if (showToasts) toast.success("📅 Set to Tomorrow")
            }
        },
        { type: 'separator' as const },
        {
            label: 'Добавить в проект',
            icon: <MoreHorizontal size={14} className="text-gray-500" />,
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
                            (task as any)?.tags?.some((t: any) => t.id === tag.id) ? "ring-2 ring-offset-2 ring-blue-400" : ""
                        )}
                        style={{ backgroundColor: tag.color }}
                    />
                ),
                onClick: () => toggleTag({ taskId, tagId: tag.id, isAttached: (task as any)?.tags?.some((t: any) => t.id === tag.id) })
            }))
        },
        { type: 'separator' as const },
        {
            label: 'Удалить',
            icon: <Trash2 size={14} />,
            variant: 'danger' as const,
            onClick: handleDelete
        }
    ]

    // Safety fallback for rendering while loading/creating
    const t = task || ({
        id: taskId,
        title: '',
        description: '',
        priority: 'none',
        is_completed: false,
        project_id: null,
        parent_id: null,
        due_date: null,
        start_time: null,
        end_time: null,
        recurrence_rule: null,
        is_project: false
    } as any)


    return (
        <div
            className="h-full flex flex-col bg-white overflow-hidden"
            onContextMenu={handleContextMenu}
        >
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 pt-3">
                <div className="mb-2 space-y-2">


                    {/* Occurrence Detach Banner */}
                    {occurrence && t.recurrence_rule && (
                        <div className="mb-2 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2.5 text-blue-700">
                                <Repeat size={16} className="shrink-0" />
                                <span className="text-sm font-medium">Это повторение задачи за {format(new Date(occurrence), 'd MMM')}</span>
                            </div>
                            <button
                                onClick={handleDetachInstance}
                                className="px-3 py-1 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-50 transition-colors shadow-sm active:scale-95 transition-transform"
                            >
                                Сделать отдельной
                            </button>
                        </div>
                    )}

                    {/* Task Header (No Frame) */}
                    <div className="group/card">

                        {/* Top Meta Row */}
                        <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-4">
                            {/* Checkbox */}
                            <button
                                onClick={toggleStatus}
                                className={clsx("transition-colors shrink-0", t.is_completed ? "text-green-500" : "text-gray-400 hover:text-gray-600")}
                            >
                                {t.is_completed ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>

                            {/* Divider */}
                            <div className="w-px h-5 bg-gray-200" />

                            {/* Date Picker */}
                            <DatePickerPopover
                                date={t.due_date ? new Date(t.due_date) : null}
                                time={t.start_time ? new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null}
                                endTime={t.end_time ? new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null}
                                recurrenceRule={t.recurrence_rule || null}
                                onUpdate={({ date, time, endTime, recurrenceRule }) => {
                                    const updates: Record<string, string | null | undefined> = {}
                                    if (date) {
                                        updates.due_date = format(date, 'yyyy-MM-dd')

                                        if (time) {
                                            const [h, m] = time.split(':').map(Number)
                                            const newStart = new Date(date)
                                            newStart.setHours(h, m, 0, 0)
                                            updates.start_time = newStart.toISOString()

                                            if (endTime) {
                                                const [eh, em] = endTime.split(':').map(Number)
                                                const newEnd = new Date(date)
                                                newEnd.setHours(eh, em, 0, 0)
                                                updates.end_time = newEnd.toISOString()
                                            } else {
                                                updates.end_time = null
                                            }
                                        } else {
                                            updates.start_time = null
                                            updates.end_time = null
                                        }
                                        updates.recurrence_rule = recurrenceRule
                                    } else {
                                        updates.due_date = null
                                        updates.start_time = null
                                        updates.end_time = null
                                        updates.recurrence_rule = null
                                    }
                                    updateTask({ taskId, updates })
                                }}
                            >
                                <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 transition-all cursor-pointer group/date" title="Set Date">
                                    <CalendarIcon size={16} className={clsx("group-hover/date:text-blue-500", t.due_date ? "text-blue-600" : "text-gray-400")} />
                                    <span className={clsx("text-sm", t.due_date ? "text-gray-700 font-medium" : "text-gray-400 italic")}>
                                        {t.due_date ? format(new Date(t.due_date), 'MMM d') : 'Set Date'}
                                        {t.start_time && <span className="ml-1 text-gray-500 font-normal">
                                            {new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            {t.end_time && ` - ${new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`}
                                        </span>}
                                        {t.recurrence_rule && <Repeat size={12} className="inline ml-1 text-blue-500" />}
                                    </span>
                                </div>
                            </DatePickerPopover>

                            <div className="flex-1" />

                            {/* Priority Selection Menu */}
                            <Menu as="div" className="relative">
                                <Menu.Button
                                    className={clsx(
                                        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all hover:bg-gray-50",
                                        t.priority === 'high' ? "bg-red-50 border-red-200 text-red-600" :
                                            t.priority === 'medium' ? "bg-amber-50 border-amber-200 text-amber-600" :
                                                t.priority === 'low' ? "bg-blue-50 border-blue-200 text-blue-600" :
                                                    "bg-white border-gray-200 text-gray-400 hover:text-gray-600"
                                    )}
                                    title={`Priority: ${t.priority || 'Normal'}`}
                                >
                                    <Flag size={16} className={clsx(t.priority && "fill-current opacity-20")} />
                                    <span className="text-xs font-bold uppercase tracking-wider">
                                        {t.priority === 'high' ? 'High' :
                                            t.priority === 'medium' ? 'Medium' :
                                                t.priority === 'low' ? 'Low' : 'Normal'}
                                    </span>
                                </Menu.Button>

                                <Transition
                                    as={Fragment}
                                    enter="transition ease-out duration-100"
                                    enterFrom="transform opacity-0 scale-95"
                                    enterTo="transform opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="transform opacity-100 scale-100"
                                    leaveTo="transform opacity-0 scale-95"
                                >
                                    <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-30 overflow-hidden">
                                        <div className="p-1">
                                            {[
                                                { id: 'none', label: 'Normal', color: 'text-gray-500', bg: 'hover:bg-gray-50' },
                                                { id: 'low', label: 'Low Priority', color: 'text-blue-500', bg: 'hover:bg-blue-50' },
                                                { id: 'medium', label: 'Medium Priority', color: 'text-amber-500', bg: 'hover:bg-amber-50' },
                                                { id: 'high', label: 'High Priority', color: 'text-red-500', bg: 'hover:bg-red-50' }
                                            ].map((opt) => (
                                                <Menu.Item key={opt.id}>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={() => updateTask({ taskId, updates: { priority: (opt.id === 'none' ? null : opt.id) as any } })}
                                                            className={clsx(
                                                                "flex w-full items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                                                                active ? opt.bg : "bg-white",
                                                                opt.color
                                                            )}
                                                        >
                                                            <Flag size={14} className={clsx(t.priority === opt.id && "fill-current")} />
                                                            {opt.label}
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            ))}
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>
                        </div>

                        {/* Breadcrumbs (Moved here) */}
                        {t.parent_id && parentTask && (
                            <div className="mb-3 pl-0">
                                <div
                                    onClick={handleBreadcrumbClick}
                                    className="flex items-center gap-2 px-2 py-1 -ml-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-600 cursor-pointer w-fit transition-all group"
                                >
                                    <ArrowUp size={14} className="text-gray-400 group-hover:text-blue-500" />
                                    <span className="font-medium text-xs truncate max-w-[300px]">Return to {parentTask.title}</span>
                                </div>
                            </div>
                        )}

                        {/* Title Row */}
                        <TextareaAutosize
                            autoFocus={searchParams.get('isNew') === 'true'}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={handleTitleBlur}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    (e.target as HTMLTextAreaElement).blur();
                                }
                            }}
                            onContextMenu={(e) => e.stopPropagation()} // Allow native menu
                            className={clsx(
                                "w-full text-xl font-semibold bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-gray-800 placeholder:text-gray-300 resize-none overflow-hidden leading-snug",
                                t.is_project && "uppercase tracking-wide text-blue-800"
                            )}
                            placeholder="What needs to be done?"
                            minRows={1}
                        />

                    </div>


                    <div onContextMenu={(e) => e.stopPropagation()}>
                        <RichTextEditor
                            key={task?.id} // Force re-render when task changes
                            content={description}
                            onChange={setDescription}
                            onBlur={handleDescriptionBlur}
                            className="mt-4"
                            placeholder="Add a description..."
                        />
                    </div>

                    <SubtaskList taskId={taskId} projectId={t.project_id} isProject={t.is_project} />
                </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 w-full px-6 py-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 flex items-center justify-between gap-4 z-20">
                {/* Meta Controls (Left) */}
                <div className="flex flex-wrap items-center gap-4">


                    {/* Project & Section Picker */}
                    <ProjectPicker
                        projectId={t.project_id || null}
                        sectionId={t.section_id || null}
                        onSelect={(pid, sid) => {
                            if (pid !== t.project_id || sid !== t.section_id) {
                                updateTask({
                                    taskId,
                                    updates: {
                                        project_id: pid ?? null, // Use null for Inbox
                                        section_id: sid
                                    }
                                })
                            }
                        }}
                    />

                    {/* Tag Manager */}
                    <TagManager taskId={taskId} />

                    {/* Project Type Toggle (GTD logic) */}
                    <div className="flex items-center gap-2 border-l border-gray-100 pl-4 py-1">
                        <button
                            onClick={() => updateTask({ taskId, updates: { is_project: !t.is_project } })}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all tracking-wider",
                                t.is_project
                                    ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-100 ring-offset-1"
                                    : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 border border-gray-200"
                            )}
                            title="Сделать проектом"
                        >
                            Проект
                        </button>
                    </div>
                </div>

                {/* Delete Button (Right) */}
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                    title="Delete task"
                >
                    {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                </button>
            </div>
            {
                contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        onClose={() => setContextMenu(null)}
                        items={menuItems as any}
                    />
                )
            }
        </div >
    )
}
