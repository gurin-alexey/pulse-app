import { useState } from 'react'
import { Plus, Loader2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSubtasks } from '@/hooks/useSubtasks'
import { useCreateTask } from '@/hooks/useCreateTask'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'

export function SubtaskList({ taskId, projectId }: { taskId: string; projectId: string | null }) {
    const { data: subtasks, isLoading } = useSubtasks(taskId)
    const { mutate: createTask } = useCreateTask()
    const { mutate: updateTask } = useUpdateTask()
    const [_, setSearchParams] = useSearchParams()
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

    const completedCount = subtasks?.filter(t => t.is_completed).length || 0
    const totalCount = subtasks?.length || 0
    const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)

    const handleAddSubtask = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newSubtaskTitle.trim()) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        createTask({
            title: newSubtaskTitle.trim(),
            projectId, // Subtask belongs to the same project
            userId: user.id,
            parentId: taskId
        }, {
            onSuccess: () => setNewSubtaskTitle('')
        })
    }

    const toggleSubtask = (subtask: any) => {
        updateTask({
            taskId: subtask.id,
            updates: { is_completed: !subtask.is_completed } as any
        })
    }

    const openSubtask = (subtaskId: string) => {
        setSearchParams({ task: subtaskId })
    }

    if (isLoading) return <div className="p-4"><Loader2 className="animate-spin w-4 h-4 text-gray-400" /></div>

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Subtasks</h3>
                <span className="text-xs text-gray-500">{completedCount}/{totalCount}</span>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div
                    className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* List */}
            <div className="space-y-1">
                {subtasks?.sort((a, b) => {
                    if (a.is_completed && !b.is_completed) return 1
                    if (!a.is_completed && b.is_completed) return -1
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                })?.map(subtask => (
                    <div key={subtask.id} className="group flex items-center p-2 rounded-md hover:bg-gray-50 -mx-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                toggleSubtask(subtask)
                            }}
                            className={clsx(
                                "flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center mr-3 transition-colors",
                                subtask.is_completed
                                    ? "bg-blue-500 border-blue-500 text-white"
                                    : "border-gray-300 hover:border-blue-500"
                            )}
                        >
                            {subtask.is_completed && <Check size={12} strokeWidth={3} />}
                        </button>
                        <span
                            onClick={() => openSubtask(subtask.id)}
                            className={clsx(
                                "text-sm flex-1 truncate transition-colors cursor-pointer hover:text-blue-600 hover:underline",
                                subtask.is_completed ? "text-gray-400 line-through" : "text-gray-700"
                            )}
                        >
                            {subtask.title}
                        </span>
                    </div>
                ))}
            </div>

            {/* Input */}
            <form onSubmit={handleAddSubtask} className="mt-2 text-sm flex items-center text-gray-400 hover:text-gray-600">
                <Plus size={16} className="mr-3" />
                <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add a subtask..."
                    className="flex-1 bg-transparent outline-none placeholder:text-gray-400 text-gray-700 py-1"
                />
            </form>
        </div>
    )
}
