import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { Fragment, useState, useEffect } from 'react'
import { format, addDays, startOfToday, startOfTomorrow, nextMonday, type Day, isSameDay, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns'
import { Calendar as CalendarIcon, Clock, Bell, Repeat, Sun, Sunrise, ChevronRight, ChevronLeft, ChevronDown, Check } from 'lucide-react'
import clsx from 'clsx'
import { RecurrenceMenu } from './RecurrenceMenu'
import { RRule } from 'rrule'

type DatePickerPopoverProps = {
    date: Date | null
    time: string | null // "HH:MM"
    recurrenceRule: string | null
    onUpdate: (updates: { date?: Date | null, time?: string | null, recurrenceRule?: string | null }) => void
    children: React.ReactNode // The trigger button
}

export function DatePickerPopover({ date, time, recurrenceRule, onUpdate, children }: DatePickerPopoverProps) {
    const [currentMonth, setCurrentMonth] = useState(date || startOfToday())
    const [selectedDate, setSelectedDate] = useState<Date | null>(date)
    const [selectedTime, setSelectedTime] = useState<string | null>(time)
    const [selectedRecurrence, setSelectedRecurrence] = useState<string | null>(recurrenceRule)

    // Sync state when props change (if controlled)
    useEffect(() => {
        setSelectedDate(date)
        setSelectedTime(time)
        setSelectedRecurrence(recurrenceRule)
        if (date) setCurrentMonth(date)
    }, [date, time, recurrenceRule])

    const today = startOfToday()

    // Calendar Generation Logic
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days = eachDayOfInterval({ start: startDate, end: endDate })

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    const handleQuickAction = (action: 'today' | 'tomorrow' | 'next-week') => {
        let newDate: Date
        if (action === 'today') newDate = startOfToday()
        else if (action === 'tomorrow') newDate = startOfTomorrow()
        else newDate = nextMonday(startOfToday())

        setSelectedDate(newDate)
        setCurrentMonth(newDate)
        // Auto-save logic could go here or on "OK"
    }

    const handleApply = (close: () => void) => {
        onUpdate({
            date: selectedDate,
            time: selectedTime,
            recurrenceRule: selectedRecurrence
        })
        close()
    }

    const handleClear = (close: () => void) => {
        onUpdate({
            date: null,
            time: null,
            recurrenceRule: null
        })
        close()
    }

    const getRecurrenceLabel = (rule: string | null) => {
        if (!rule) return "Do not repeat"
        // Rough parse for display
        try {
            // Basic RRule humanizing or simply "Repeats"
            const rr = RRule.fromString(rule)
            return rr.toText()
        } catch (e) {
            return "Custom"
        }
    }

    return (
        <Popover className="relative">
            {({ open, close }) => (
                <>
                    <PopoverButton as="div" className="outline-none">
                        {children}
                    </PopoverButton>

                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-200"
                        enterFrom="opacity-0 translate-y-1"
                        enterTo="opacity-100 translate-y-0"
                        leave="transition ease-in duration-150"
                        leaveFrom="opacity-100 translate-y-0"
                        leaveTo="opacity-0 translate-y-1"
                    >
                        <PopoverPanel className="absolute left-0 z-50 mt-2 w-[320px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden text-sm font-sans">
                            {/* Header Tabs */}
                            <div className="p-2 bg-gray-50/50 border-b border-gray-100 flex gap-1">
                                <button className="flex-1 py-1.5 text-center bg-white rounded-lg shadow-sm text-gray-900 font-medium text-xs">
                                    Date
                                </button>
                                <button className="flex-1 py-1.5 text-center text-gray-500 hover:bg-gray-100/50 rounded-lg font-medium text-xs">
                                    Duration
                                </button>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <button
                                    onClick={() => handleQuickAction('today')}
                                    className="flex flex-col items-center gap-1 group"
                                    title="Today"
                                >
                                    <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                                        <Sun size={16} />
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-medium">Today</span>
                                </button>

                                <button
                                    onClick={() => handleQuickAction('tomorrow')}
                                    className="flex flex-col items-center gap-1 group"
                                    title="Tomorrow"
                                >
                                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                        <Sunrise size={16} />
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-medium">Tmrw</span>
                                </button>

                                <button
                                    onClick={() => handleQuickAction('next-week')}
                                    className="flex flex-col items-center gap-1 group"
                                    title="Next Week"
                                >
                                    <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                                        <CalendarIcon size={16} />
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-medium">Next Wk</span>
                                </button>
                            </div>

                            {/* Calendar Grid */}
                            <div className="p-4">
                                {/* Month Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <button
                                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                        className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="font-semibold text-gray-800">
                                        {format(currentMonth, 'MMMM yyyy')}
                                    </span>
                                    <button
                                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                        className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-7 mb-2">
                                    {weekDays.map(d => (
                                        <div key={d} className="text-center text-xs text-gray-400 font-medium">
                                            {d}
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-y-1">
                                    {days.map((day, dayIdx) => {
                                        const isSameMonthDay = isSameMonth(day, currentMonth)
                                        const isSelected = selectedDate && isSameDay(day, selectedDate)
                                        const isToday = isSameDay(day, today)

                                        return (
                                            <button
                                                key={day.toString()}
                                                onClick={() => setSelectedDate(day)}
                                                className={clsx(
                                                    "h-8 w-8 mx-auto flex items-center justify-center rounded-full text-xs font-medium transition-all relative",
                                                    isSelected
                                                        ? "bg-[#2e3b55] text-white shadow-md shadow-blue-900/10"
                                                        : isSameMonthDay
                                                            ? "text-gray-700 hover:bg-gray-100"
                                                            : "text-gray-300 hover:text-gray-500",
                                                    isToday && !isSelected && "font-bold text-blue-600 after:content-[''] after:absolute after:bottom-1 after:w-1 after:h-1 after:bg-blue-600 after:rounded-full"
                                                )}
                                            >
                                                {format(day, 'd')}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Options List */}
                            <div className="border-t border-gray-100">
                                {/* Time */}
                                <div className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50">
                                    <Clock size={16} className="text-gray-400 mr-3" />
                                    <input
                                        type="time"
                                        value={selectedTime || ''}
                                        onChange={(e) => setSelectedTime(e.target.value)}
                                        className="bg-transparent border-none p-0 text-sm text-gray-700 focus:ring-0 flex-1 cursor-pointer"
                                        placeholder="Add time"
                                    />
                                </div>

                                {/* Reminder (Placeholder) */}
                                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 cursor-pointer group">
                                    <div className="flex items-center">
                                        <Bell size={16} className="text-gray-400 mr-3 group-hover:text-gray-600" />
                                        <span className="text-gray-600">Remind me</span>
                                    </div>
                                    <ChevronRight size={14} className="text-gray-300" />
                                </div>

                                {/* Recurrence */}
                                <RecurrenceMenu
                                    selectedDate={selectedDate}
                                    value={selectedRecurrence}
                                    onChange={setSelectedRecurrence}
                                >
                                    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full">
                                        <div className="flex items-center overflow-hidden">
                                            <Repeat size={16} className={clsx("mr-3 shrink-0", selectedRecurrence ? "text-blue-600" : "text-gray-400")} />
                                            <span className={clsx("truncate pr-2", selectedRecurrence ? "text-blue-600 font-medium" : "text-gray-600")}>
                                                {getRecurrenceLabel(selectedRecurrence)}
                                            </span>
                                        </div>
                                        <ChevronRight size={14} className="text-gray-300 shrink-0" />
                                    </div>
                                </RecurrenceMenu>
                            </div>

                            {/* Footer */}
                            <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex gap-2">
                                <button
                                    onClick={() => handleClear(close)}
                                    className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={() => handleApply(close)}
                                    className="flex-1 py-2 rounded-lg bg-[#2e3b55] text-white text-sm font-medium hover:bg-[#232d42] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                >
                                    Done
                                </button>
                            </div>
                        </PopoverPanel>
                    </Transition>
                </>
            )}
        </Popover>
    )
}
