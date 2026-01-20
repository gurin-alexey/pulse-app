import { useState, useMemo } from "react"
import { useTasks } from "@/hooks/useTasks"
import { useProjects } from "@/hooks/useProjects"
import { useTags } from "@/features/tags"
import { TaskItem } from "@/features/tasks/TaskItem"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { Loader2, AlertCircle, Filter, X, CheckSquare } from "lucide-react"
import clsx from "clsx"
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns"
import { ru } from "date-fns/locale"

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all'

export function CompletedTasksPage() {
    const isMobile = useMediaQuery("(max-width: 768px)")
    const [period, setPeriod] = useState<Period>('today')
    const [selectedProject, setSelectedProject] = useState<string>("")
    const [selectedTag, setSelectedTag] = useState<string>("")
    const [selectedPriority, setSelectedPriority] = useState<string>("")

    const { data: projects } = useProjects()
    const { data: tags } = useTags()

    // Preparing filter object
    const filter = useMemo(() => {
        return {
            type: 'completed' as const,
            period,
            projectId: selectedProject || undefined,
            tags: selectedTag ? [selectedTag] : undefined,
            priority: selectedPriority || undefined
        }
    }, [period, selectedProject, selectedTag, selectedPriority])

    const { data: tasks, isLoading, isError } = useTasks(filter)

    // Grouping logic for "All" or longer periods
    const groupedTasks = useMemo(() => {
        if (!tasks) return {}

        const groups: Record<string, typeof tasks> = {}

        tasks.forEach(task => {
            if (!task.completed_at) return
            const date = new Date(task.completed_at)
            const key = format(date, 'yyyy-MM-dd')
            if (!groups[key]) groups[key] = []
            groups[key].push(task)
        })

        return groups
    }, [tasks])

    const sortedDates = Object.keys(groupedTasks).sort((a, b) => b.localeCompare(a))

    const getDateLabel = (dateStr: string) => {
        const date = new Date(dateStr)
        if (isToday(date)) return "Сегодня"
        if (isYesterday(date)) return "Вчера"
        return format(date, 'd MMMM yyyy, EEEE', { locale: ru })
    }

    const clearFilters = () => {
        setPeriod('today')
        setSelectedProject("")
        setSelectedTag("")
        setSelectedPriority("")
    }

    const hasActiveFilters = period !== 'today' || selectedProject || selectedTag || selectedPriority

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3 sticky top-0 bg-white z-20">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        Завершенные
                        <span className="text-gray-400 text-sm font-normal">
                            {tasks ? tasks.length : 0}
                        </span>
                    </h2>

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                            <X size={14} /> Сбросить
                        </button>
                    )}
                </div>

                {/* Filters Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Period Selector */}
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as Period)}
                        className="text-sm border-gray-200 rounded-md py-1 px-2 bg-gray-50 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                    >
                        <option value="today">Сегодня</option>
                        <option value="yesterday">Вчера</option>
                        <option value="week">За неделю</option>
                        <option value="month">За месяц</option>
                        <option value="all">За все время</option>
                    </select>

                    {/* Project Filter */}
                    <select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        className={clsx(
                            "text-sm border-gray-200 rounded-md py-1 px-2 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer max-w-[150px]",
                            selectedProject ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50"
                        )}
                    >
                        <option value="">Все проекты</option>
                        {projects?.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    {/* Tag Filter */}
                    <select
                        value={selectedTag}
                        onChange={(e) => setSelectedTag(e.target.value)}
                        className={clsx(
                            "text-sm border-gray-200 rounded-md py-1 px-2 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer max-w-[150px]",
                            selectedTag ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-gray-50"
                        )}
                    >
                        <option value="">Все теги</option>
                        {tags?.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>

                    {/* Priority Filter */}
                    <select
                        value={selectedPriority}
                        onChange={(e) => setSelectedPriority(e.target.value)}
                        className={clsx(
                            "text-sm border-gray-200 rounded-md py-1 px-2 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer",
                            selectedPriority ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-gray-50"
                        )}
                    >
                        <option value="">Все приоритеты</option>
                        <option value="p1">P1 (Высокий)</option>
                        <option value="p2">P2 (Средний)</option>
                        <option value="p3">P3 (Низкий)</option>
                        <option value="p4">P4 (Без приоритета)</option>
                    </select>
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto px-2 py-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40 text-gray-400">
                        <Loader2 className="animate-spin mr-2" /> Загрузка...
                    </div>
                ) : isError ? (
                    <div className="flex items-center justify-center h-40 text-red-500">
                        <AlertCircle className="mr-2" /> Ошибка загрузки задач
                    </div>
                ) : tasks?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-gray-400">
                        <div className="bg-gray-50 p-4 rounded-full mb-3">
                            <CheckSquare size={32} className="opacity-20" />
                        </div>
                        <p>Нет завершенных задач за выбранный период</p>
                    </div>
                ) : (
                    <div className="space-y-6 pb-20">
                        {sortedDates.map(dateStr => (
                            <div key={dateStr}>
                                <h3 className="text-sm font-semibold text-gray-500 mb-2 px-2 sticky top-0 bg-white/90 backdrop-blur-sm py-1 z-10 w-fit rounded-md">
                                    {getDateLabel(dateStr)}
                                </h3>
                                <div className="space-y-1">
                                    {groupedTasks[dateStr].map(task => (
                                        <TaskItem
                                            key={task.id}
                                            task={task}
                                            isActive={false}
                                            viewMode="all"
                                            disableStrikethrough={true}
                                            isMobile={isMobile}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
