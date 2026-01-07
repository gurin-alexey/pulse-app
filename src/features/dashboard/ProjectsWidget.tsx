import { useTasks } from "@/hooks/useTasks"
import { Loader2, FolderKanban, ChevronRight, AlertCircle, Clock } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { format, differenceInCalendarDays } from "date-fns"
import { ru } from "date-fns/locale"
import clsx from "clsx"

export function ProjectsWidget() {
    const { data: projects, isLoading, isError } = useTasks({ type: 'is_project' })
    const [_, setSearchParams] = useSearchParams()

    // stripHtml removed

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

    const visibleProjects = projects?.filter(t => !t.is_completed && (t.subtasks_count || 0) > 0) || []

    const getDateColor = (dateStr: string) => {
        const days = differenceInCalendarDays(new Date(dateStr), new Date())
        if (days < 0) return "bg-red-100 text-red-600 border-red-200"
        if (days === 0) return "bg-orange-100 text-orange-600 border-orange-200"
        if (days <= 2) return "bg-yellow-100 text-yellow-700 border-yellow-200"
        return "bg-gray-100 text-gray-500 border-gray-200"
    }

    const formatDeadline = (dateStr: string) => {
        const days = differenceInCalendarDays(new Date(dateStr), new Date())
        if (days === 0) return "СЕГОДНЯ"
        if (days === 1) return "ЗАВТРА"
        if (days === -1) return "ВЧЕРА"

        if (days > 0) return `${days} дн.`
        return `${Math.abs(days)} дн. назад`
    }

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 uppercase tracking-wide">DEADLINE</h3>
                        <p className="text-xs text-gray-400 font-medium">{visibleProjects.length} remaining</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                {visibleProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                        <FolderKanban size={32} className="mb-2 opacity-50" />
                        <p className="text-sm">No deadlines</p>
                    </div>
                ) : (
                    visibleProjects.map((task) => (
                        <div
                            key={task.id}
                            onClick={() => setSearchParams({ task: task.id })}
                            className="group flex flex-col p-3 rounded-xl bg-gray-50 hover:bg-purple-50 border border-transparent hover:border-purple-100 transition-all cursor-pointer relative"
                        >
                            <div className="flex justify-between items-start w-full gap-2">
                                <h4 className="font-bold text-gray-700 truncate group-hover:text-purple-700 transition-colors flex-1 uppercase text-sm leading-tight">
                                    {task.title}
                                </h4>
                                {task.due_date && (
                                    <span className={clsx(
                                        "text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap border",
                                        getDateColor(task.due_date)
                                    )}>
                                        {formatDeadline(task.due_date)}
                                    </span>
                                )}
                            </div>

                            {/* Description removed */}

                            <ChevronRight size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 group-hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100" />
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

