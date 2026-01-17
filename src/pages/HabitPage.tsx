import { useMemo, useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { useHabits } from "@/hooks/useHabits"
import { useUpdateHabit } from "@/hooks/useUpdateHabit"
import { useHabitLogs } from "@/hooks/useHabitLogs"
import { useUpsertHabitLog } from "@/hooks/useUpsertHabitLog"
import { useDeleteHabitLog } from "@/hooks/useDeleteHabitLog"
import { supabase } from "@/lib/supabase"
import {
    format,
    subDays,
    isToday,
    isYesterday,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    startOfWeek,
    isBefore,
    isAfter,
    addMonths
} from "date-fns"
import { ru } from "date-fns/locale"
import { Check, X, Minus, Save } from "lucide-react"
import clsx from "clsx"

const getLocalDateStr = (date: Date) => {
    const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
    return local.toISOString().split('T')[0]
}

export function HabitPage() {
    const { habitId } = useParams()
    const { data: habits, isLoading: habitsLoading } = useHabits()
    const { mutate: updateHabit, isPending: isSaving } = useUpdateHabit()
    const habit = habits?.find(h => h.id === habitId)
    const today = new Date()
    const todayStr = getLocalDateStr(today)
    const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(today))
    const monthStart = startOfMonth(monthAnchor)
    const monthEnd = endOfMonth(monthAnchor)
    const thirtyDaysAgo = subDays(today, 30)
    const rangeStart = isBefore(monthStart, thirtyDaysAgo) ? monthStart : thirtyDaysAgo
    const rangeEnd = isAfter(monthEnd, today) ? monthEnd : today
    const fromStr = getLocalDateStr(rangeStart)
    const toStr = getLocalDateStr(rangeEnd)
    const { data: logs, isLoading: logsLoading } = useHabitLogs({
        from: fromStr,
        to: toStr,
        habitId: habitId || undefined
    })
    const { mutate: upsertHabitLog, isPending: isUpserting } = useUpsertHabitLog()
    const { mutate: deleteHabitLog, isPending: isDeleting } = useDeleteHabitLog()

    const todayLog = logs?.find(log => log.log_date === todayStr)

    const [description, setDescription] = useState("")
    const [frequencyType, setFrequencyType] = useState<'daily' | 'weekly' | 'interval'>('daily')
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])
    const [intervalDays, setIntervalDays] = useState(2)
    const [goalPerDay, setGoalPerDay] = useState(1)
    const [reminderEnabled, setReminderEnabled] = useState(false)
    const [reminderTime, setReminderTime] = useState("09:00")

    useEffect(() => {
        if (!habit) return
        setDescription(habit.description || "")
        setFrequencyType((habit.frequency_type as 'daily' | 'weekly' | 'interval') || 'daily')
        setDaysOfWeek(habit.days_of_week && habit.days_of_week.length > 0 ? habit.days_of_week : [1, 2, 3, 4, 5, 6, 7])
        setIntervalDays(habit.interval_days || 2)
        setGoalPerDay(habit.goal_per_day || 1)
        setReminderEnabled(!!habit.reminder_enabled)
        setReminderTime(habit.reminder_time || "09:00")
    }, [habit])

    const stats = useMemo(() => {
        if (!logs) return { done7: 0, streak: 0, done30: 0 }
        const logMap = new Map(logs.map(log => [log.log_date, log.status]))
        let done7 = 0
        for (let i = 0; i < 7; i += 1) {
            const dayStr = getLocalDateStr(subDays(new Date(), i))
            if (logMap.get(dayStr) === 'done') {
                done7 += 1
            }
        }
        let done30 = 0
        for (let i = 0; i < 30; i += 1) {
            const dayStr = getLocalDateStr(subDays(new Date(), i))
            if (logMap.get(dayStr) === 'done') {
                done30 += 1
            }
        }
        let streak = 0
        for (let i = 0; i < 31; i += 1) {
            const dayStr = getLocalDateStr(subDays(new Date(), i))
            if (logMap.get(dayStr) === 'done') {
                streak += 1
            } else {
                break
            }
        }
        return { done7, streak, done30 }
    }, [logs])

    const calendarDays = useMemo(() => {
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
        const startGrid = startOfWeek(monthStart, { weekStartsOn: 1 })
        const leadingBlanks = Math.max(0, Math.round((monthStart.getTime() - startGrid.getTime()) / (1000 * 60 * 60 * 24)))
        return { days, leadingBlanks }
    }, [monthStart, monthEnd])

    const monthOptions = useMemo(() => {
        return Array.from({ length: 15 }).map((_, idx) => {
            const date = addMonths(startOfMonth(today), idx - 12)
            return {
                value: format(date, 'yyyy-MM'),
                label: format(date, 'LLLL yyyy', { locale: ru }),
                date
            }
        })
    }, [today])

    const logByDate = useMemo(() => {
        const map = new Map<string, { id: string, status: HabitLog['status'] }>()
        logs?.forEach(log => map.set(log.log_date, { id: log.id, status: log.status }))
        return map
    }, [logs])

    const last7 = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const date = subDays(today, 6 - i)
            const dateStr = getLocalDateStr(date)
            return {
                date,
                dateStr,
                status: logByDate.get(dateStr)?.status
            }
        })
    }, [today, logByDate])

    const last30Percent = Math.round((stats.done30 / 30) * 100)

    const handleToggleCalendarDay = async (date: Date) => {
        if (!habit) return
        if (isAfter(date, today)) return

        const dateStr = getLocalDateStr(date)
        const log = logByDate.get(dateStr)

        if (!log) {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            upsertHabitLog({ habitId: habit.id, userId: user.id, logDate: dateStr, status: 'done' })
            return
        }

        if (log.status === 'done') {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            upsertHabitLog({ habitId: habit.id, userId: user.id, logDate: dateStr, status: 'missed' })
            return
        }

        if (log.status === 'missed') {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            upsertHabitLog({ habitId: habit.id, userId: user.id, logDate: dateStr, status: 'skipped' })
            return
        }

        deleteHabitLog(log.id)
    }

    const handleSetStatus = async (status: 'done' | 'missed' | 'skipped') => {
        if (!habit) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        upsertHabitLog({
            habitId: habit.id,
            userId: user.id,
            logDate: todayStr,
            status
        })
    }

    const handleClearToday = () => {
        if (todayLog) {
            deleteHabitLog(todayLog.id)
        }
    }

    const toggleDay = (day: number) => {
        setDaysOfWeek(prev => {
            if (prev.includes(day)) {
                return prev.filter(d => d !== day)
            }
            return [...prev, day].sort((a, b) => a - b)
        })
    }

    const handleSaveSettings = () => {
        if (!habit) return
        const updates = {
            description: description || null,
            frequency_type: frequencyType,
            days_of_week: frequencyType === 'weekly' ? daysOfWeek : null,
            interval_days: frequencyType === 'interval' ? Math.max(1, intervalDays) : null,
            goal_per_day: Math.max(1, goalPerDay),
            reminder_enabled: reminderEnabled,
            reminder_time: reminderEnabled ? reminderTime : null
        }
        updateHabit({ habitId: habit.id, updates })
    }

    const getDateLabel = (dateStr: string) => {
        const date = new Date(dateStr)
        if (isToday(date)) return "Сегодня"
        if (isYesterday(date)) return "Вчера"
        return format(date, 'd MMMM yyyy', { locale: ru })
    }

    if (habitsLoading) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                Loading habit...
            </div>
        )
    }

    if (!habit) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <div>Habit not found</div>
                <Link to="/dashboard" className="text-blue-600 text-sm hover:underline">Go to dashboard</Link>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3 sticky top-0 bg-white z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {habit.emoji ? (
                            <span className="text-xl">{habit.emoji}</span>
                        ) : (
                            <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: habit.color || "#93c5fd" }}
                            />
                        )}
                        <h2 className="font-bold text-lg text-gray-800">
                            {habit.name}
                        </h2>
                    </div>
                    <div className="text-xs text-gray-400">
                        {stats.done7}/7 · streak {stats.streak}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleSetStatus('done')}
                        disabled={isUpserting}
                        className={clsx(
                            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border",
                            todayLog?.status === 'done'
                                ? "bg-emerald-500 text-white border-emerald-500"
                                : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        )}
                    >
                        <Check size={14} /> Done
                    </button>
                    <button
                        onClick={() => handleSetStatus('missed')}
                        disabled={isUpserting}
                        className={clsx(
                            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border",
                            todayLog?.status === 'missed'
                                ? "bg-red-500 text-white border-red-500"
                                : "bg-white text-red-500 border-red-200 hover:bg-red-50"
                        )}
                    >
                        <X size={14} /> Missed
                    </button>
                    <button
                        onClick={() => handleSetStatus('skipped')}
                        disabled={isUpserting}
                        className={clsx(
                            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border",
                            todayLog?.status === 'skipped'
                                ? "bg-gray-500 text-white border-gray-500"
                                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        )}
                    >
                        <Minus size={14} /> Skipped
                    </button>
                    {todayLog && (
                        <button
                            onClick={handleClearToday}
                            disabled={isDeleting}
                            className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                        >
                            Clear today
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">Настройки</h3>
                        <button
                            onClick={handleSaveSettings}
                            disabled={isSaving}
                            className="flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            <Save size={14} />
                            Сохранить
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-500">Описание</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                placeholder="Зачем эта привычка и как выполнять"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs text-gray-500">Периодичность</label>
                                <select
                                    value={frequencyType}
                                    onChange={(e) => setFrequencyType(e.target.value as 'daily' | 'weekly' | 'interval')}
                                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="daily">Каждый день</option>
                                    <option value="weekly">По дням недели</option>
                                    <option value="interval">Раз в N дней</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Цель в день</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={goalPerDay}
                                    onChange={(e) => setGoalPerDay(Number(e.target.value || 1))}
                                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Напоминание</label>
                                <div className="mt-1 flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={reminderEnabled}
                                        onChange={(e) => setReminderEnabled(e.target.checked)}
                                    />
                                    <input
                                        type="time"
                                        value={reminderTime}
                                        onChange={(e) => setReminderTime(e.target.value)}
                                        disabled={!reminderEnabled}
                                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                                    />
                                </div>
                            </div>
                        </div>

                        {frequencyType === 'weekly' && (
                            <div>
                                <label className="text-xs text-gray-500">Дни недели</label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7].map((day, idx) => (
                                        <button
                                            key={day}
                                            onClick={() => toggleDay(day)}
                                            className={clsx(
                                                "px-3 py-1 text-xs rounded-full border",
                                                daysOfWeek.includes(day)
                                                    ? "bg-blue-600 text-white border-blue-600"
                                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                            )}
                                        >
                                            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][idx]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {frequencyType === 'interval' && (
                            <div className="max-w-xs">
                                <label className="text-xs text-gray-500">Интервал (дней)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={intervalDays}
                                    onChange={(e) => setIntervalDays(Number(e.target.value || 1))}
                                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-4 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">Calendar</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))}
                                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-50"
                            >
                                ←
                            </button>
                            <select
                                value={format(monthAnchor, 'yyyy-MM')}
                                onChange={(e) => {
                                    const selected = monthOptions.find(option => option.value === e.target.value)
                                    if (selected) setMonthAnchor(selected.date)
                                }}
                                className="text-xs text-gray-500 bg-transparent focus:outline-none"
                            >
                                {monthOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))}
                                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-50"
                            >
                                →
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-2 text-[10px] text-gray-400 mb-2">
                        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label) => (
                            <div key={label} className="text-center">{label}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: calendarDays.leadingBlanks }).map((_, idx) => (
                            <div key={`blank-${idx}`} />
                        ))}
                        {calendarDays.days.map((day) => {
                            const dateStr = getLocalDateStr(day)
                            const status = logByDate.get(dateStr)?.status
                            const isFuture = isAfter(day, today)
                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => handleToggleCalendarDay(day)}
                                    className={clsx(
                                        "h-8 rounded-lg border text-xs flex items-center justify-center",
                                        status === 'done' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                                        status === 'missed' && "bg-red-50 border-red-200 text-red-700",
                                        status === 'skipped' && "bg-gray-50 border-gray-200 text-gray-600",
                                        !status && "bg-white border-gray-100 text-gray-400",
                                        isFuture && "opacity-40 cursor-not-allowed"
                                    )}
                                    disabled={isFuture}
                                    title="Toggle status"
                                >
                                    {format(day, 'd')}
                                </button>
                            )
                        })}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> done</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> missed</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> skipped</div>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-400">
                        Click a day to cycle: done → missed → skipped → clear
                    </div>
                </div>

                <div className="px-4 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Progress</h3>
                    <div className="flex items-end gap-2 h-16">
                        {last7.map((day) => (
                            <div key={day.dateStr} className="flex flex-col items-center gap-1 flex-1">
                                <div
                                    className={clsx(
                                        "w-full rounded-sm",
                                        day.status === 'done' ? "bg-emerald-400" :
                                            day.status === 'missed' ? "bg-red-400" :
                                                day.status === 'skipped' ? "bg-gray-300" :
                                                    "bg-gray-100"
                                    )}
                                    style={{ height: day.status ? "100%" : "25%" }}
                                />
                                <span className="text-[10px] text-gray-400">{format(day.date, 'd')}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4">
                        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                            <span>Last 30 days</span>
                            <span>{last30Percent}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400" style={{ width: `${last30Percent}%` }} />
                        </div>
                    </div>
                </div>

                {logsLoading && (
                    <div className="p-4 text-gray-400 text-sm">Loading logs...</div>
                )}

                {!logsLoading && (!logs || logs.length === 0) && (
                    <div className="p-6 text-sm text-gray-400 text-center">
                        No logs yet
                    </div>
                )}

                {logs && logs.length > 0 && (
                    <div className="divide-y divide-gray-100">
                        {logs.map((log) => (
                            <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    {getDateLabel(log.log_date)}
                                </div>
                                <span className={clsx(
                                    "text-xs font-semibold px-2 py-1 rounded-full border",
                                    log.status === 'done' && "bg-emerald-50 text-emerald-600 border-emerald-200",
                                    log.status === 'missed' && "bg-red-50 text-red-600 border-red-200",
                                    log.status === 'skipped' && "bg-gray-50 text-gray-600 border-gray-200"
                                )}>
                                    {log.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
