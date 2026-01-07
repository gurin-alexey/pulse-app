import { useTasks } from "@/hooks/useTasks"
import { Loader2, Target, AlertCircle, ChevronRight, Trophy } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { isThisMonth, parseISO, format, compareAsc } from "date-fns"
import { ru } from "date-fns/locale"
import clsx from "clsx"

export function FocusWidget() {
    const { data: tasks, isLoading, isError } = useTasks({ type: 'all' })
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
                <span className="text-sm">Failed to load focus tasks</span>
            </div>
        )
    }

    // Logic: High Priority + Due This Month + Not Completed
    const focusTasks = tasks?.filter(t => {
        if (t.is_completed) return false
        if (t.priority !== 'high') return false // Only High Priority
        if (!t.due_date) return false // Must have a date

        return isThisMonth(parseISO(t.due_date))
    }).sort((a, b) => {
        return compareAsc(parseISO(a.due_date!), parseISO(b.due_date!))
    }) || []

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                        <Target size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 uppercase tracking-wide">FOCUS OF THE MONTH</h3>
                        <p className="text-xs text-gray-400 font-medium">{focusTasks.length} goals</p>
                    </div>
                </div>
                <Trophy size={18} className="text-amber-400" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                {focusTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                        <Target size={32} className="mb-2 opacity-50" />
                        <p className="text-sm">No high priority goals for this month</p>
                    </div>
                ) : (
                    focusTasks.map((task) => (
                        <div
                            key={task.id}
                            onClick={() => setSearchParams({ task: task.id })}
                            className="group flex flex-col p-3 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-all cursor-pointer relative"
                        >
                            <div className="flex justify-between items-start w-full gap-2">
                                <h4 className="font-bold text-gray-700 truncate group-hover:text-emerald-700 transition-colors flex-1 uppercase text-sm leading-tight">
                                    {task.title}
                                </h4>
                                <span className={clsx(
                                    "text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap border bg-white border-gray-200 text-gray-600"
                                )}>
                                    {format(parseISO(task.due_date!), 'd MMM', { locale: ru }).toUpperCase()}
                                </span>
                            </div>

                            <ChevronRight size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 group-hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100" />
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
