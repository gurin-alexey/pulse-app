import { useTasks } from "@/hooks/useTasks"
import { Calendar, Clock, AlertCircle, CheckCircle2 } from "lucide-react"
import clsx from "clsx"

export function DeadlineTasksWidget() {
    const { data: tasks, isLoading } = useTasks({ type: 'today' }) // Just mock 'today' for urgency
    const urgentTasks = tasks?.filter(t => !t.is_completed).slice(0, 5) || []

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-50 text-red-500 rounded-lg">
                        <AlertCircle size={16} />
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm">Urgent & Today</h3>
                </div>
                <span className="text-xs font-semibold text-gray-400">{urgentTasks.length} pending</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {isLoading && (
                    <div className="text-center py-4 text-gray-300">Loading tasks...</div>
                )}

                {!isLoading && urgentTasks.length === 0 && (
                    <div className="text-center py-8 flex flex-col items-center opacity-50">
                        <CheckCircle2 size={32} className="text-green-500 mb-2" />
                        <p className="text-sm text-gray-500">All caught up!</p>
                    </div>
                )}

                {urgentTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl hover:bg-gray-100 transition-colors group">
                        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${task.priority === 'high' ? 'bg-red-500' :
                                task.priority === 'medium' ? 'bg-orange-500' : 'bg-blue-400'
                            }`} />
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-700 truncate">{task.title}</h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                {task.due_time && (
                                    <span className="flex items-center gap-1 text-red-400">
                                        <Clock size={10} /> {task.due_time?.slice(0, 5) || "All Day"}
                                    </span>
                                )}
                                {!task.due_time && (
                                    <span className="flex items-center gap-1">
                                        <Calendar size={10} /> Today
                                    </span>
                                )}
                                {task.project_id && (
                                    <span className="bg-white border border-gray-200 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
                                        Project
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
