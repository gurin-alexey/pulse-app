import { useEffect, useState, useRef } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import { useTask } from '@/hooks/useTask'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useDeleteTask } from '@/hooks/useDeleteTask'
import { X, Loader2, CheckSquare, Square, Trash2, Calendar as CalendarIcon, ChevronRight, ArrowUp, Flag, Repeat } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { SubtaskList } from './SubtaskList'
import { TagManager } from '../tags/TagManager'
import { useProjects } from '@/hooks/useProjects'
import { Folder } from 'lucide-react'
import { useTaskDateHotkeys } from '@/hooks/useTaskDateHotkeys'
import { DatePickerPopover } from '@/components/ui/date-picker/DatePickerPopover'
import { format } from 'date-fns'

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
            <div className="flex-1 overflow-y-auto px-6 pt-3 pb-24">
                <div className="mb-2 space-y-2">
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

                    {/* Task Header (No Frame) */}
                    <div className="group/card">

                        {/* Top Meta Row */}
                        <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-4">
                            {/* Checkbox */}
                            <button
                                onClick={toggleStatus}
                                className={clsx("transition-colors shrink-0", task.is_completed ? "text-green-500" : "text-gray-400 hover:text-gray-600")}
                            >
                                {task.is_completed ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>

                            {/* Divider */}
                            <div className="w-px h-5 bg-gray-200" />

                            {/* Date Picker */}
                            <DatePickerPopover
                                date={task.due_date ? new Date(task.due_date) : null}
                                time={task.start_time ? new Date(task.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null}
                                recurrenceRule={task.recurrence_rule || null}
                                onUpdate={({ date, time, recurrenceRule }) => {
                                    const updates: Record<string, string | null | undefined> = {}
                                    if (date) {
                                        updates.due_date = format(date, 'yyyy-MM-dd')

                                        if (time) {
                                            const [h, m] = time.split(':').map(Number)
                                            const newStart = new Date(date)
                                            newStart.setHours(h, m, 0, 0)
                                            updates.start_time = newStart.toISOString()
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
                                    <CalendarIcon size={16} className={clsx("group-hover/date:text-blue-500", task.due_date ? "text-blue-600" : "text-gray-400")} />
                                    <span className={clsx("text-sm", task.due_date ? "text-gray-700 font-medium" : "text-gray-400 italic")}>
                                        {task.due_date ? format(new Date(task.due_date), 'MMM d') : 'Set Date'}
                                        {task.start_time && <span className="ml-1 text-gray-500 font-normal">{new Date(task.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
                                        {task.recurrence_rule && <Repeat size={12} className="inline ml-1 text-blue-500" />}
                                    </span>
                                </div>
                            </DatePickerPopover>

                            <div className="flex-1" />

                            {/* Priority Flag */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    const next: Record<string, 'low' | 'medium' | 'high'> = { 'none': 'low', 'low': 'medium', 'medium': 'high', 'high': 'low' }
                                    const current = (task.priority as string) || 'none'
                                    updateTask({ taskId, updates: { priority: next[current] } })
                                }}
                                className={clsx(
                                    "p-1.5 rounded transition-all hover:bg-gray-50",
                                    task.priority === 'high' ? "text-red-500" :
                                        task.priority === 'medium' ? "text-orange-500" :
                                            task.priority === 'low' ? "text-blue-500" : "text-gray-300 hover:text-gray-500"
                                )}
                                title={`Priority: ${task.priority || 'None'}`}
                            >
                                <Flag size={18} className={clsx(task.priority && "fill-current opacity-20")} />
                            </button>
                        </div>

                        {/* Title Row */}
                        <div>
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
                                className="w-full text-xl font-semibold bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-gray-800 placeholder:text-gray-300 resize-none overflow-hidden leading-snug"
                                placeholder="What needs to be done?"
                                minRows={1}
                            />
                        </div>
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
                                    updateTask({ taskId, updates: { project_id: pid ?? undefined, section_id: null } })
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
                            onClick={() => updateTask({ taskId, updates: { is_project: !task.is_project } })}
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
