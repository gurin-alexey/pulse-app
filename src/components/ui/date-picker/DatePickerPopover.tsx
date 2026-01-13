import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { Fragment, useState, useEffect } from 'react'
import { format, addDays, startOfToday, startOfTomorrow, nextMonday, type Day, isSameDay, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns'
import { Calendar as CalendarIcon, Clock, Bell, Repeat, Sun, Sunrise, ChevronRight, ChevronLeft, ChevronDown, Check, ArrowRight, X } from 'lucide-react'
import clsx from 'clsx'
import { RecurrenceMenu } from './RecurrenceMenu'
import { RRule } from 'rrule'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Drawer } from 'vaul'

type DatePickerPopoverProps = {
    date: Date | null
    time: string | null // "HH:MM"
    endTime: string | null // "HH:MM"
    recurrenceRule: string | null
    onUpdate: (updates: { date?: Date | null, time?: string | null, endTime?: string | null, recurrenceRule?: string | null }) => void
    children: React.ReactNode // The trigger button
}

export function DatePickerPopover({ date, time, endTime, recurrenceRule, onUpdate, children }: DatePickerPopoverProps) {
    const isMobile = useMediaQuery("(max-width: 768px)")
    const [isOpen, setIsOpen] = useState(false)

    // State is lifted here to persist while drawer animates, but reset on open
    const [selectedDate, setSelectedDate] = useState<Date | null>(date)
    const [selectedTime, setSelectedTime] = useState<string | null>(time)
    const [selectedEndTime, setSelectedEndTime] = useState<string | null>(endTime)
    const [selectedRecurrence, setSelectedRecurrence] = useState<string | null>(recurrenceRule)

    // Sync state when props change or when opening
    useEffect(() => {
        setSelectedDate(date)
        setSelectedTime(time)
        setSelectedEndTime(endTime)
        setSelectedRecurrence(recurrenceRule)
    }, [date, time, endTime, recurrenceRule, isOpen]) // Re-sync on open

    const handleApply = (close?: () => void) => {
        onUpdate({
            date: selectedDate,
            time: selectedTime,
            endTime: selectedEndTime,
            recurrenceRule: selectedRecurrence
        })
        close?.()
        setIsOpen(false)
    }

    const handleClear = (close?: () => void) => {
        onUpdate({
            date: null,
            time: null,
            endTime: null,
            recurrenceRule: null
        })
        close?.()
        setIsOpen(false)
    }

    if (isMobile) {
        return (
            <Drawer.NestedRoot open={isOpen} onOpenChange={setIsOpen}>
                <Drawer.Trigger asChild onClick={() => setIsOpen(true)}>
                    {children}
                </Drawer.Trigger>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/40 z-[60]" />
                    <Drawer.Content
                        className="bg-white flex flex-col rounded-t-[10px] fixed bottom-0 left-0 right-0 z-[60] focus:outline-none max-h-[90vh] pb-6 px-4"
                        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                    >
                        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mt-4 mb-4" />
                        <div className="flex-1 overflow-y-auto w-full">
                            <DatePickerBody
                                selectedDate={selectedDate}
                                setSelectedDate={setSelectedDate}
                                selectedTime={selectedTime}
                                setSelectedTime={setSelectedTime}
                                selectedEndTime={selectedEndTime}
                                setSelectedEndTime={setSelectedEndTime}
                                selectedRecurrence={selectedRecurrence}
                                setSelectedRecurrence={setSelectedRecurrence}
                                onApply={() => handleApply()}
                                onClear={() => handleClear()}
                                isMobile={true}
                            />
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.NestedRoot>
        )
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
                        <PopoverPanel
                            anchor="bottom start"
                            className="z-[100] mt-2 w-[280px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden text-sm font-sans"
                        >
                            <DatePickerBody
                                selectedDate={selectedDate}
                                setSelectedDate={setSelectedDate}
                                selectedTime={selectedTime}
                                setSelectedTime={setSelectedTime}
                                selectedEndTime={selectedEndTime}
                                setSelectedEndTime={setSelectedEndTime}
                                selectedRecurrence={selectedRecurrence}
                                setSelectedRecurrence={setSelectedRecurrence}
                                onApply={() => handleApply(close)}
                                onClear={() => handleClear(close)}
                                isMobile={false}
                            />
                        </PopoverPanel>
                    </Transition>
                </>
            )}
        </Popover>
    )
}

// Extracted Body Component
function DatePickerBody({
    selectedDate, setSelectedDate,
    selectedTime, setSelectedTime,
    selectedEndTime, setSelectedEndTime,
    selectedRecurrence, setSelectedRecurrence,
    onApply, onClear, isMobile
}: any) {
    const [currentMonth, setCurrentMonth] = useState(selectedDate || startOfToday())

    // Generate 30-minute slots
    const timeSlots: string[] = []
    for (let i = 0; i < 24; i++) {
        const h = i.toString().padStart(2, '0')
        timeSlots.push(`${h}:00`)
        timeSlots.push(`${h}:30`)
    }

    const today = startOfToday()
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
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
    }

    const getRecurrenceLabel = (rule: string | null) => {
        if (!rule) return "Do not repeat"
        try {
            const rr = RRule.fromString(rule)
            return rr.toText()
        } catch (e) {
            return "Custom"
        }
    }

    return (
        <div className={clsx(isMobile && "w-full pb-6")}>
            {/* Quick Actions */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <button onClick={() => handleQuickAction('today')} className="flex flex-col items-center gap-1 group">
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                        <Sun size={20} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Today</span>
                </button>
                <button onClick={() => handleQuickAction('tomorrow')} className="flex flex-col items-center gap-1 group">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        <Sunrise size={20} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Tmrw</span>
                </button>
                <button onClick={() => handleQuickAction('next-week')} className="flex flex-col items-center gap-1 group">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                        <CalendarIcon size={20} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Next Wk</span>
                </button>
            </div>

            {/* Calendar Grid */}
            <div className={clsx("p-3", isMobile ? "w-full" : "")}>
                {/* Month Header */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="font-semibold text-gray-800">{format(currentMonth, 'MMMM yyyy')}</span>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div className="grid grid-cols-7 mb-2">
                    {weekDays.map(d => <div key={d} className={clsx("text-center font-medium text-gray-400", isMobile ? "text-sm" : "text-xs")}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-y-1 w-full">
                    {days.map((day) => {
                        const isSameMonthDay = isSameMonth(day, currentMonth)
                        const isSelected = selectedDate && isSameDay(day, selectedDate)
                        const isToday = isSameDay(day, today)
                        return (
                            <button
                                key={day.toString()}
                                onClick={() => setSelectedDate(day)}
                                className={clsx(
                                    "mx-auto flex items-center justify-center rounded-lg font-medium transition-all relative",
                                    isMobile ? "h-10 w-10 text-sm rounded-xl" : "h-9 w-9 text-xs rounded-lg", // Intermediate size on mobile
                                    isSelected ? "bg-[#2e3b55] text-white shadow-md" : isSameMonthDay ? "text-gray-700 hover:bg-gray-100" : "text-gray-300",
                                    isToday && !isSelected && "font-bold text-blue-600 after:absolute after:bottom-1 after:w-1 after:h-1 after:bg-blue-600 after:rounded-full"
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
                <div className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <Clock size={16} className="text-gray-400 mr-3 shrink-0" />
                    <div className="relative">
                        <select value={selectedTime || ''} onChange={(e) => setSelectedTime(e.target.value)} className="bg-transparent border-none p-0 text-sm text-gray-700 focus:ring-0 w-[70px] cursor-pointer outline-none">
                            <option value="">Time</option>
                            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                            {selectedTime && !timeSlots.includes(selectedTime) && <option value={selectedTime}>{selectedTime}</option>}
                        </select>
                    </div>
                    {selectedTime && (
                        <div className="flex items-center ml-2 animate-in fade-in slide-in-from-left-2 duration-200">
                            <ArrowRight size={14} className="text-gray-400 mx-1" />
                            <select value={selectedEndTime || ''} onChange={(e) => setSelectedEndTime(e.target.value)} className="bg-transparent border-none p-0 text-sm text-gray-700 focus:ring-0 w-[70px] cursor-pointer outline-none">
                                <option value="">End</option>
                                {timeSlots.filter(t => t > (selectedTime || '')).map(t => <option key={t} value={t}>{t}</option>)}
                                {selectedEndTime && (!timeSlots.includes(selectedEndTime) || selectedEndTime <= selectedTime) && <option value={selectedEndTime}>{selectedEndTime}</option>}
                            </select>
                            {selectedEndTime && <button onClick={() => setSelectedEndTime(null)} className="ml-1 text-gray-400 hover:text-gray-600 rounded-full p-0.5"><X size={12} /></button>}
                        </div>
                    )}
                    <button className="ml-auto text-gray-400 hover:text-blue-600 p-1 rounded-full"><Bell size={16} /></button>
                </div>

                <RecurrenceMenu selectedDate={selectedDate} value={selectedRecurrence} onChange={setSelectedRecurrence}>
                    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full">
                        <div className="flex items-center overflow-hidden">
                            <Repeat size={16} className={clsx("mr-3 shrink-0", selectedRecurrence ? "text-blue-600" : "text-gray-400")} />
                            <span className={clsx("truncate pr-2", selectedRecurrence ? "text-blue-600 font-medium" : "text-gray-600")}>{getRecurrenceLabel(selectedRecurrence)}</span>
                        </div>
                        <ChevronRight size={14} className="text-gray-300 shrink-0" />
                    </div>
                </RecurrenceMenu>
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex gap-2 mt-2">
                <button onClick={onClear} className="flex-1 py-3 rounded-lg bg-white border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 shadow-sm">
                    Clear
                </button>
                <button onClick={onApply} className="flex-1 py-3 rounded-lg bg-[#2e3b55] text-white text-sm font-medium hover:bg-[#232d42] shadow-sm">
                    Done
                </button>
            </div>
        </div>
    )
}
