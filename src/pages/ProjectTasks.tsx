import { useParams, useSearchParams } from "react-router-dom"
import { useTasks } from "@/hooks/useTasks"
import { AlertCircle, Loader2 } from "lucide-react"
import { CreateTaskInput } from "@/features/tasks/CreateTaskInput"
import clsx from "clsx"

export function ProjectTasks() {
    const { projectId } = useParams<{ projectId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: tasks, isLoading, isError } = useTasks(projectId)

    const activeTaskId = searchParams.get('task')

    const handleTaskClick = (taskId: string) => {
        setSearchParams({ task: taskId })
    }

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
            <div className="p-4 border-b border-gray-100 flex items-center justify-between h-16 shrink-0 sticky top-0 bg-white z-10">
                <h2 className="font-bold text-lg text-gray-800">Tasks</h2>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
                {projectId && <CreateTaskInput projectId={projectId} />}

                {tasks?.length === 0 ? (
                    <div className="text-gray-400 text-center mt-10">
                        No tasks yet
                    </div>
                ) : (
                    <div className="space-y-2">
                        {tasks?.map((task) => (
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
                                    checked={task.status === 'done'}
                                    readOnly
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3 cursor-pointer"
                                />
                                <span className={clsx("font-medium", task.status === 'done' ? "text-gray-400 line-through" : "text-gray-700")}>
                                    {task.title}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
