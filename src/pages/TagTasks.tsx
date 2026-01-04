import { useParams, useSearchParams } from "react-router-dom"
import { useTagTasks } from "@/hooks/useTagTasks"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { useTags } from "@/hooks/useTags"
import { AlertCircle, Loader2, Tag as TagIcon } from "lucide-react"
import clsx from "clsx"

export function TagTasks() {
    const { tagId } = useParams<{ tagId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: tasks, isLoading, isError } = useTagTasks(tagId)
    const { data: tags } = useTags()
    const { mutate: updateTask } = useUpdateTask()

    const activeTaskId = searchParams.get('task')
    const currentTag = tags?.find(t => t.id === tagId)

    const handleTaskClick = (taskId: string) => {
        setSearchParams({ task: taskId })
    }

    const toggleStatus = (e: React.MouseEvent, task: any) => {
        e.stopPropagation()
        updateTask({
            taskId: task.id,
            updates: { is_completed: !task.is_completed }
        })
    }

    const sortedTasks = tasks ? [...tasks].sort((a, b) => {
        if (a.is_completed && !b.is_completed) return 1
        if (!a.is_completed && b.is_completed) return -1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }) : []

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                <Loader2 className="animate-spin mr-2" />
                Loading tasks...
            </div>
        )
    }

    if (isError) {
        return (
            <div className="flex items-center justify-center h-full text-red-500">
                <AlertCircle className="mr-2" />
                Error loading tasks
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center gap-3 h-16 shrink-0 sticky top-0 bg-white z-10">
                <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: currentTag?.color || '#ccc' }}
                />
                <h2 className="font-bold text-lg text-gray-800">
                    {currentTag?.name || 'Tag Tasks'}
                </h2>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
                {sortedTasks?.length === 0 ? (
                    <div className="text-gray-400 text-center mt-10">
                        No tasks with this tag
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sortedTasks?.map((task) => (
                            <div
                                key={task.id}
                                onClick={() => handleTaskClick(task.id)}
                                className={clsx(
                                    "flex items-center p-3 border rounded-lg transition-colors group cursor-pointer",
                                    activeTaskId === task.id
                                        ? "bg-blue-50 border-blue-200"
                                        : "bg-white border-gray-100 hover:bg-gray-50"
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={task.is_completed}
                                    onChange={() => { }}
                                    onClick={(e) => toggleStatus(e, task)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className={clsx("font-medium truncate", task.is_completed ? "text-gray-400 line-through" : "text-gray-700")}>
                                            {task.title}
                                        </div>
                                        {/* Tags */}
                                        <div className="flex items-center gap-1">
                                            {task.tags?.map((tag) => (
                                                <div
                                                    key={tag.id}
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: tag.color }}
                                                    title={tag.name}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs mt-0.5">
                                        {task.due_date && (
                                            <span className={clsx(
                                                new Date(task.due_date) < new Date() && !task.is_completed ? "text-red-500 font-medium" : "text-gray-400"
                                            )}>
                                                {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                        {task.start_time && (
                                            <span className="text-gray-400">
                                                {new Date(task.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
