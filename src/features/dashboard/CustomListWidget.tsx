import { useState, useMemo } from "react"
import { useTasks, TaskFilter } from "@/hooks/useTasks"
import { useProjects } from "@/hooks/useProjects"
import { Loader2, List, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import clsx from "clsx"

export function CustomListWidget() {
    const [selectedListId, setSelectedListId] = useState(() => localStorage.getItem('dashboard_custom_list_id') || 'inbox')
    const { data: projects } = useProjects()
    const [_, setSearchParams] = useSearchParams()

    const handleListChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newValue = e.target.value
        setSelectedListId(newValue)
        localStorage.setItem('dashboard_custom_list_id', newValue)
    }

    const filter: TaskFilter = useMemo(() => {
        if (selectedListId === 'inbox') return { type: 'inbox' }
        if (selectedListId === 'today') return { type: 'today' }
        if (selectedListId === 'tomorrow') return { type: 'tomorrow' }
        // Check if it's a project
        if (projects?.some(p => p.id === selectedListId)) {
            return { type: 'project', projectId: selectedListId }
        }
        // Fallback
        return { type: 'inbox' }
    }, [selectedListId, projects])

    const { data: tasks, isLoading, isError } = useTasks(filter)

    const visibleTasks = tasks?.filter(t => !t.is_completed) || []

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                        <List size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <select
                            value={selectedListId}
                            onChange={handleListChange}
                            className="w-full bg-transparent font-bold text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 rounded cursor-pointer -ml-1 py-1 px-1"
                        >
                            <option value="inbox">Inbox</option>
                            <option value="today">Today</option>
                            <option value="tomorrow">Tomorrow</option>
                            {projects && projects.length > 0 && (
                                <optgroup label="Projects">
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                        <p className="text-xs text-gray-400 font-medium ml-1">{visibleTasks.length} tasks</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                {isLoading && (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" /></div>
                )}

                {!isLoading && visibleTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                        <CheckCircle2 size={32} className="mb-2 opacity-30" />
                        <p className="text-sm">List is empty</p>
                    </div>
                )}

                {visibleTasks.map((task) => (
                    <div
                        key={task.id}
                        onClick={() => setSearchParams({ task: task.id })}
                        className="group flex items-center p-2.5 rounded-lg bg-gray-50 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all cursor-pointer"
                    >
                        <div className={clsx(
                            "w-2 h-2 rounded-full mr-3 shrink-0",
                            task.priority === 'high' ? "bg-red-400" :
                                task.priority === 'medium' ? "bg-orange-400" :
                                    "bg-blue-400"
                        )} />
                        <span className="text-sm text-gray-700 truncate flex-1">{task.title}</span>
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors opacity-0 group-hover:opacity-100" />
                    </div>
                ))}
            </div>
        </div>
    )
}
