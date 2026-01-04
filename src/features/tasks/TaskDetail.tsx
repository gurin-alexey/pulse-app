import { useEffect, useState } from 'react'
import { useTask } from '@/hooks/useTask'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { X, Loader2, CheckCircle2, Circle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'

type TaskDetailProps = {
    taskId: string
}

export function TaskDetail({ taskId }: TaskDetailProps) {
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: task, isLoading } = useTask(taskId)
    const { mutate: updateTask } = useUpdateTask()

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

    const handleClose = () => {
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('task')
        setSearchParams(newParams)
    }

    const handleTitleBlur = () => {
        if (task && title !== task.title) {
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
        const newStatus = task.status === 'done' ? 'todo' : 'done'
        updateTask({ taskId, updates: { status: newStatus } })
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
                        className={clsx("transition-colors", task.status === 'done' ? "text-green-500" : "text-gray-400 hover:text-gray-600")}
                    >
                        {task.status === 'done' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>

                    <span className="text-xs text-gray-400 uppercase font-semibold">
                        {task.status === 'done' ? 'Completed' : 'Open'}
                    </span>
                </div>

                <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-50">
                    <X size={20} />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleTitleBlur}
                        className="w-full text-2xl font-bold border-none focus:ring-0 p-0 text-gray-800 placeholder:text-gray-300"
                        placeholder="Task title"
                    />
                </div>

                <div className="h-full">
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={handleDescriptionBlur}
                        className="w-full h-[calc(100%-100px)] resize-none text-gray-600 border-none focus:ring-0 p-0 text-base leading-relaxed placeholder:text-gray-300"
                        placeholder="Add a description..."
                    />
                </div>
            </div>
        </div>
    )
}
