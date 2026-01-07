import { useTasks } from "@/hooks/useTasks"
import { Loader2, FolderKanban, ChevronRight, AlertCircle } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import clsx from "clsx"

export function ProjectsWidget() {
    const { data: projects, isLoading, isError } = useTasks({ type: 'is_project' })
    const [_, setSearchParams] = useSearchParams()

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-blue-500" />
            </div>
        )
    }

    if (isError) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center h-full text-red-500">
                <AlertCircle className="mb-2" />
                <span className="text-sm">Failed to load projects</span>
            </div>
        )
    }

    const visibleProjects = projects?.filter(t => !t.is_completed) || []

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                        <FolderKanban size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800">Active Projects</h3>
                        <p className="text-xs text-gray-400 font-medium">{visibleProjects.length} remaining</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                {visibleProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                        <FolderKanban size={32} className="mb-2 opacity-50" />
                        <p className="text-sm">No active multi-step tasks</p>
                    </div>
                ) : (
                    visibleProjects.map((task) => (
                        <div
                            key={task.id}
                            onClick={() => setSearchParams({ task: task.id })}
                            className="group flex items-center p-3 rounded-xl bg-gray-50 hover:bg-purple-50 border border-transparent hover:border-purple-100 transition-all cursor-pointer"
                        >
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-700 truncate group-hover:text-purple-700 transition-colors">
                                    {task.title}
                                </h4>
                                {task.description && (
                                    <p className="text-xs text-gray-400 truncate mt-0.5">
                                        {task.description}
                                    </p>
                                )}
                            </div>
                            <ChevronRight size={16} className="text-gray-300 group-hover:text-purple-400 transition-colors" />
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
