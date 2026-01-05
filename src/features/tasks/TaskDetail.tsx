import { useEffect, useState, useRef } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import { useTask } from '@/hooks/useTask'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useDeleteTask } from '@/hooks/useDeleteTask'
import { X, Loader2, CheckSquare, Square, Trash2, Calendar as CalendarIcon, ChevronRight, ArrowUp } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { SubtaskList } from './SubtaskList'
import { TagManager } from '../tags/TagManager'
import { useProjects } from '@/hooks/useProjects'
import { Folder } from 'lucide-react'
import { useTaskDateHotkeys } from '@/hooks/useTaskDateHotkeys'

type TaskDetailProps = {
    taskId: string
}

export function TaskDetail({ taskId }: TaskDetailProps) {
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: task, isLoading } = useTask(taskId)
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask()
    const { data: projects } = useProjects()

    // Enable hotkeys for this active task
    useTaskDateHotkeys(taskId, !!task)

    // Local state for auto-save inputs
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')

    // Sync local state when task loads
    useEffect(() => {
        if (task) {
            setTitle(task.title || '')
            setDescription(task.description || '')
        }
    }, [task])

    // Keep track of title for unmount check
    const titleRef = useRef(title)
    useEffect(() => {
        titleRef.current = title
    }, [title])

    // Cleanup empty new tasks on unmount (covers close button, backdrop click, nav, etc.)
    useEffect(() => {
        return () => {
            // Check if we are truly closing (URL no longer contains this task)
            // This prevents deletion during React Strict Mode double-mount
            const currentParams = new URLSearchParams(window.location.search)
            if (!currentParams.get('task') && !titleRef.current.trim()) {
                deleteTask(taskId)
            }
        }
    }, [taskId]) // Run cleanup when taskId changes or component unmounts

    const handleClose = () => {
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('task')
        newParams.delete('isNew')
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

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value || null
        const updates: any = { due_date: date }

        if (date && task?.start_time) {
            // Sync start_time/end_time dates while preserving time
            const [year, month, day] = date.split('-').map(Number)

            const oldStart = new Date(task.start_time)
            // Note: Month is 0-indexed in Date constructor
            const newStart = new Date(year, month - 1, day, oldStart.getHours(), oldStart.getMinutes())
            updates.start_time = newStart.toISOString()

            if (task.end_time) {
                const oldEnd = new Date(task.end_time)
                const newEnd = new Date(year, month - 1, day, oldEnd.getHours(), oldEnd.getMinutes())
                updates.end_time = newEnd.toISOString()
            }
        }

        if (!date) {
            updates.start_time = null
            updates.end_time = null
        }

        updateTask({ taskId, updates })
    }

    const toggleStatus = () => {
        if (!task) return
        updateTask({ taskId, updates: { is_completed: !task.is_completed } })
    }

    const handleDelete = () => {
        deleteTask(taskId)
    }

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <Loader2 className="animate-spin mr-2" />
                Loading details...
            </div>
        )
    }

    if (!task) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                Task not found
            </div>
        )
    }

    // Breadcrumb Data
    // We can use a separate useTask call for the parent, or lightweight fetch
    // Since we need it reactive, useTask is fine.
    const { data: parentTask } = useTask(task?.parent_id || '')

    // ... (keep existing effects)

    const handleBreadcrumbClick = () => {
        if (task?.parent_id) {
            setSearchParams({ task: task.parent_id })
        }
    }



    return (
        <div className="h-full flex flex-col bg-white overflow-hidden relative">
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-24">
                <div className="mb-6 space-y-4">
                    {/* Top Row: Breadcrumbs (Left) + Date/Time (Right) */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                        {/* Breadcrumbs */}
                        <div>
                            {task.parent_id && parentTask && (
                                <div
                                    onClick={handleBreadcrumbClick}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-blue-600 cursor-pointer w-fit transition-all group"
                                >
                                    <ArrowUp size={16} className="text-gray-500 group-hover:text-blue-500" />
                                    <span className="font-medium text-sm truncate max-w-[300px]">{parentTask.title}</span>
                                </div>
                            )}
                        </div>

                        {/* Date & Time (moved from footer) */}
                        <div className="flex items-center gap-2">
                            <div
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-100 hover:border-gray-300 transition-colors cursor-help"
                                title="Tip: Alt+1 (Today), Alt+2 (Tomorrow), Alt+3 (Next Week)"
                            >
                                <CalendarIcon size={16} className="text-gray-400" />
                                <input
                                    type="date"
                                    value={task.due_date ? task.due_date.split('T')[0] : ''}
                                    onChange={handleDateChange}
                                    className="bg-transparent border-none p-0 text-gray-600 focus:ring-0 cursor-pointer text-sm"
                                />
                            </div>

                            {/* Time Picker */}
                            {task.due_date && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-100 hover:border-gray-300 transition-colors">
                                    <input
                                        type="time"
                                        value={task.start_time ? new Date(task.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                                        onChange={(e) => {
                                            const time = e.target.value
                                            if (!time) return

                                            const datePart = task.due_date ? task.due_date.split('T')[0] : null
                                            if (!datePart) return

                                            const newStart = `${datePart}T${time}:00`
                                            const startDate = new Date(newStart)

                                            let endDateStr = task.end_time
                                            if (!endDateStr) {
                                                endDateStr = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString()
                                            } else {
                                                const currentEnd = new Date(endDateStr)
                                                if (currentEnd <= startDate) {
                                                    endDateStr = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString()
                                                }
                                            }

                                            updateTask({
                                                taskId,
                                                updates: {
                                                    start_time: startDate.toISOString(),
                                                    end_time: endDateStr
                                                }
                                            })
                                        }}
                                        className="bg-transparent border-none p-0 text-gray-600 focus:ring-0 cursor-pointer text-sm w-[46px]"
                                    />
                                    {task.start_time && (
                                        <>
                                            <span className="text-gray-400">-</span>
                                            <input
                                                type="time"
                                                value={task.end_time ? new Date(task.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                                                onChange={(e) => {
                                                    const time = e.target.value
                                                    if (!time) return

                                                    const datePart = task.due_date ? task.due_date.split('T')[0] : null
                                                    if (!datePart) return

                                                    const newEnd = `${datePart}T${time}:00`
                                                    updateTask({
                                                        taskId,
                                                        updates: {
                                                            end_time: new Date(newEnd).toISOString()
                                                        }
                                                    })
                                                }}
                                                className="bg-transparent border-none p-0 text-gray-600 focus:ring-0 cursor-pointer text-sm w-[46px]"
                                            />
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                            onClick={toggleStatus}
                            className={clsx("mt-1.5 transition-colors shrink-0", task.is_completed ? "text-green-500" : "text-gray-300 hover:text-gray-500")}
                        >
                            {task.is_completed ? <CheckSquare size={24} /> : <Square size={24} />}
                        </button>

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
                            className="w-full text-2xl font-bold bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-gray-800 placeholder:text-gray-300 resize-none overflow-hidden leading-tight"
                            placeholder="Task title"
                            minRows={1}
                        />
                    </div>

                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={handleDescriptionBlur}
                        className="w-full min-h-[120px] resize-none text-gray-600 border-none focus:ring-0 p-1 text-base leading-relaxed placeholder:text-gray-300 ml-9"
                        placeholder="Add a description..."
                    />

                    <SubtaskList taskId={task.id} projectId={task.project_id} isProject={task.is_project} />
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 w-full px-6 py-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 flex items-center justify-between gap-4 z-20">
                {/* Meta Controls (Left) */}
                <div className="flex flex-wrap items-center gap-4">


                    {/* Project Picker */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-100 hover:border-gray-300 transition-colors relative group/project">
                        <Folder size={16} className="text-gray-400" />
                        <select
                            value={task.project_id || ''}
                            onChange={(e) => {
                                const pid = e.target.value || null
                                if (pid !== task.project_id) {
                                    updateTask({ taskId, updates: { project_id: pid ?? undefined, section_id: null as any } })
                                }
                            }}
                            className="bg-transparent border-none p-0 text-gray-600 focus:ring-0 cursor-pointer text-sm appearance-none pr-4 min-w-[60px]"
                        >
                            <option value="">Inbox</option>
                            <optgroup label="Projects">
                                {projects?.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    {/* Tag Manager */}
                    <TagManager taskId={task.id} />

                    {/* Project Type Toggle (GTD logic) */}
                    <div className="flex items-center gap-2 border-l border-gray-100 pl-4 py-1">
                        <button
                            onClick={() => updateTask({ taskId, updates: { is_project: !task.is_project } as any })}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                                task.is_project
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            )}
                            title="Mark as Project"
                        >
                            {task.is_project ? "PROJECT" : "Task"}
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
        </div>
    )
}
