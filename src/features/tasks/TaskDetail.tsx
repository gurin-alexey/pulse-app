import { useEffect, useState, useRef } from 'react'
import { useTask } from '@/hooks/useTask'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useDeleteTask } from '@/hooks/useDeleteTask'
import { X, Loader2, CheckCircle2, Circle, Trash2, Calendar as CalendarIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { SubtaskList } from './SubtaskList'
import { TagManager } from '../tags/TagManager'
import { useProjects } from '@/hooks/useProjects'
import { Folder } from 'lucide-react'

type TaskDetailProps = {
    taskId: string
}

export function TaskDetail({ taskId }: TaskDetailProps) {
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: task, isLoading } = useTask(taskId)
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask()
    const { data: projects } = useProjects()

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

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-4">
                    {/* Checkbox / Status toggle */}
                    <button
                        onClick={toggleStatus}
                        className={clsx("transition-colors", task.is_completed ? "text-green-500" : "text-gray-400 hover:text-gray-600")}
                    >
                        {task.is_completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>

                    <span className="text-xs text-gray-400 uppercase font-semibold">
                        {task.is_completed ? 'Completed' : 'Open'}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                        title="Delete task"
                    >
                        {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                    </button>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-50">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6 space-y-4">
                    <input
                        autoFocus={searchParams.get('isNew') === 'true'}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleTitleBlur}
                        className="w-full text-2xl font-bold border-none focus:ring-0 p-0 text-gray-800 placeholder:text-gray-300"
                        placeholder="Task title"
                    />

                    {/* Meta Controls */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-100 hover:border-gray-300 transition-colors">
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

                        {/* Project Picker */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-100 hover:border-gray-300 transition-colors relative group/project">
                            <Folder size={16} className="text-gray-400" />
                            <select
                                value={task.project_id || ''}
                                onChange={(e) => {
                                    const pid = e.target.value || null
                                    if (pid !== task.project_id) {
                                        updateTask({ taskId, updates: { project_id: pid, section_id: null as any } })
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
                    </div>
                </div>

                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleDescriptionBlur}
                    className="w-full min-h-[120px] resize-none text-gray-600 border-none focus:ring-0 p-0 text-base leading-relaxed placeholder:text-gray-300 mt-4"
                    placeholder="Add a description..."
                />

                {/* Subtasks */}
                <SubtaskList taskId={task.id} projectId={task.project_id} />
            </div>
        </div>
    )
}
