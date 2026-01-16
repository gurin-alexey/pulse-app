import { useState, useEffect, Fragment, useRef, useMemo } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { subMonths, addMonths } from 'date-fns'
import ruLocale from '@fullcalendar/core/locales/ru'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Loader2, ArrowLeft, Settings } from 'lucide-react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { DateSelectArg } from "@fullcalendar/core"

import { useAllTasks } from '@/hooks/useAllTasks'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useCreateTask } from '@/hooks/useCreateTask'
import { useSettings } from "@/store/useSettings"
import { supabase } from '@/lib/supabase'

import { buildCalendarEvents, renderCalendarEventContent } from '@/features/calendar/calendarEvents'
import { RecurrenceEditModal } from "@/components/ui/date-picker/RecurrenceEditModal"
import { useTaskOccurrence } from '@/hooks/useTaskOccurrence'
import { useRecurrenceUpdate } from '@/hooks/useRecurrenceUpdate'
import { useAllDayResizer } from '@/features/calendar/useAllDayResizer'

import './calendar.css'

interface EventDropArg {
    event: any
    oldEvent?: any
    revert: () => void
}

export function DailyPlanner() {
    const { data, isLoading } = useAllTasks()

    const tasks = data?.tasks
    const occurrencesMap = data?.occurrencesMap
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createTask } = useCreateTask()
    const { setOccurrenceStatus } = useTaskOccurrence()

    // Recurrence Modal State
    const [recurrenceModalOpen, setRecurrenceModalOpen] = useState(false)
    const [pendingCalendarUpdate, setPendingCalendarUpdate] = useState<any>(null)
    const [allowedModes, setAllowedModes] = useState<('single' | 'following' | 'all')[] | undefined>(undefined)

    const [_, setSearchParams] = useSearchParams()
    const navigate = useNavigate()
    const { settings } = useSettings()
    const hideNightTime = settings?.preferences?.hide_night_time ?? false

    const calendarRef = useRef<FullCalendar>(null)
    const calendarContainerRef = useRef<HTMLDivElement>(null)
    const [currentDate, setCurrentDate] = useState(new Date())

    // Zoom State (same as CalendarPage)
    const ZOOM_LEVELS = ['00:15:00', '00:30:00', '01:00:00', '02:00:00', '04:00:00']
    const [zoomIndex, setZoomIndex] = useState(2) // Default 01:00:00

    // All-day resizer
    const { maxRows: allDayMaxRows } = useAllDayResizer({ containerRef: calendarContainerRef })

    // Zoom with Ctrl+Scroll
    useEffect(() => {
        const container = calendarContainerRef.current
        if (!container) return

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault()
                const direction = e.deltaY > 0 ? 1 : -1
                setZoomIndex(prev => {
                    const next = prev + direction
                    if (next >= 0 && next < ZOOM_LEVELS.length) return next
                    return prev
                })
            }
        }

        container.addEventListener('wheel', handleWheel, { passive: false })
        return () => container.removeEventListener('wheel', handleWheel)
    }, [])

    const handlePrev = () => {
        calendarRef.current?.getApi().prev()
    }

    const handleNext = () => {
        calendarRef.current?.getApi().next()
    }

    const handleToday = () => {
        calendarRef.current?.getApi().today()
    }

    const [showCompleted, setShowCompleted] = useState(() => {
        try {
            const saved = localStorage.getItem('pulse_calendar_show_completed')
            return saved ? JSON.parse(saved) : false
        } catch {
            return false
        }
    })

    useEffect(() => {
        localStorage.setItem('pulse_calendar_show_completed', JSON.stringify(showCompleted))
    }, [showCompleted])


    const events = useMemo(() => {
        const rangeStart = subMonths(currentDate, 3)
        const rangeEnd = addMonths(currentDate, 3)

        return buildCalendarEvents({
            tasks,
            occurrencesMap,
            rangeStart,
            rangeEnd,
            showCompleted
        })
    }, [tasks, occurrencesMap, currentDate, showCompleted])

    if (isLoading && !tasks) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <Loader2 className="animate-spin mr-2" />
                Загрузка расписания...
            </div>
        )
    }

    const handleDateSelect = async (selectInfo: DateSelectArg) => {
        const calendarApi = selectInfo.view.calendar
        calendarApi.unselect()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const isAllDay = selectInfo.allDay
        let updates: any = {
            title: '',
            projectId: null,
            userId: user.id
        }

        if (isAllDay) {
            const d = selectInfo.start
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            updates.due_date = `${year}-${month}-${day}`
        } else {
            updates.start_time = selectInfo.startStr
            updates.end_time = selectInfo.endStr
            updates.due_date = selectInfo.startStr.split('T')[0]
        }

        createTask(updates, {
            onSuccess: (newTask) => {
                setSearchParams({ task: newTask.id, isNew: 'true', origin: 'calendar' })
            }
        })
    }

    const handleEventClick = (info: any) => {
        info.jsEvent.preventDefault()

        const occurrence = info.event.extendedProps?.occurrenceDate
        const originalId = info.event.extendedProps?.originalId || info.event.id

        const params: any = { task: originalId, origin: 'calendar' }
        if (occurrence) params.occurrence = occurrence
        setSearchParams(params)
    }

    const { confirmRecurrenceUpdate } = useRecurrenceUpdate()

    const handleRecurrenceConfirm = async (mode: 'single' | 'following' | 'all') => {
        if (!pendingCalendarUpdate) return
        const { taskId, updates, occurrenceDate } = pendingCalendarUpdate

        // Find task to get details
        const task = tasks?.find(t => t.id === taskId)
        if (!task) return

        await confirmRecurrenceUpdate({
            task,
            mode,
            occurrenceDate,
            updates
        })

        setPendingCalendarUpdate(null)
        setRecurrenceModalOpen(false)
        setAllowedModes(undefined)
    }

    const handleEventDrop = (info: EventDropArg) => {
        let taskId = info.event.extendedProps?.originalId || info.event.extendedProps?.original_id || info.event.id
        if (taskId && taskId.includes('_recur_')) {
            taskId = taskId.split('_recur_')[0]
        }

        // Check if task is recurring
        const task = tasks?.find(t => t.id === taskId)
        const isRecurring = !!task?.recurrence_rule
        const occurrence = info.event.extendedProps?.occurrenceDate
        const isVirtual = !!info.event.extendedProps?.isVirtual

        const isAllDay = info.event.allDay
        let updates: any = {}

        if (isAllDay && info.event.start) {
            const d = info.event.start
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            updates.due_date = `${year}-${month}-${day}`
            updates.start_time = null
            updates.end_time = null
        } else {
            updates.start_time = info.event.start?.toISOString() || null
            updates.end_time = info.event.end?.toISOString() || null

            if (info.event.start) {
                const d = info.event.start
                const year = d.getFullYear()
                const month = String(d.getMonth() + 1).padStart(2, '0')
                const day = String(d.getDate()).padStart(2, '0')
                updates.due_date = `${year}-${month}-${day}`
            }
        }

        if (isRecurring && occurrence) {
            info.revert() // Rollback UI

            // Calculate allowed modes
            const oldDate = occurrence
            const newDate = updates.due_date
            const isDateChange = oldDate !== newDate
            const isFirstInstance = oldDate?.split('T')[0] === task.due_date?.split('T')[0]

            let modes: ('single' | 'following' | 'all')[] = []
            if (isDateChange) {
                // Rule 3: Date changed -> only Single and Following
                modes = ['single', 'following']
            } else {
                // Only time change
                if (isFirstInstance) {
                    // For first instance, 'following' and 'all' are identical. Show only 'all'.
                    modes = ['single', 'all']
                } else if (isVirtual) {
                    modes = ['single', 'following', 'all']
                } else {
                    modes = ['single', 'all']
                }
            }

            setAllowedModes(modes)
            setPendingCalendarUpdate({ taskId, updates, occurrenceDate: occurrence })
            setRecurrenceModalOpen(true)
        } else {
            updateTask({ taskId, updates })
        }
    }

    const handleEventResize = (info: any) => {
        let taskId = info.event.extendedProps?.originalId || info.event.extendedProps?.original_id || info.event.id
        if (taskId && taskId.includes('_recur_')) {
            taskId = taskId.split('_recur_')[0]
        }

        const task = tasks?.find(t => t.id === taskId)
        const isRecurring = !!task?.recurrence_rule
        const occurrence = info.event.extendedProps?.occurrenceDate
        const isVirtual = !!info.event.extendedProps?.isVirtual

        const updates = {
            start_time: info.event.start?.toISOString() || null,
            end_time: info.event.end?.toISOString() || null
        }

        if (isRecurring && occurrence) {
            info.revert()

            // Resize is always time change, never date change (FullCalendar restricts this typically)
            let modes: ('single' | 'following' | 'all')[] = []
            if (isVirtual) {
                modes = ['single', 'following', 'all']
            } else {
                modes = ['single', 'all']
            }

            setAllowedModes(modes)
            setPendingCalendarUpdate({ taskId, updates, occurrenceDate: occurrence })
            setRecurrenceModalOpen(true)
        } else {
            updateTask({ taskId, updates })
        }
    }


    return (
        <div className="h-full flex flex-col bg-white overflow-hidden relative">
            {/* Toolbar - unified with CalendarPage */}
            <div className="flex items-center justify-between px-4 py-4 shrink-0 relative">
                {/* Left: Back to week button - expands on hover */}
                <button
                    onClick={() => navigate('/calendar')}
                    className="group flex items-center gap-0 hover:gap-2 p-3 hover:px-4 text-sm font-medium text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all duration-200 shadow-sm z-10"
                >
                    <ArrowLeft size={22} className="shrink-0" />
                    <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[140px] transition-all duration-200 font-medium">
                        Показать неделю
                    </span>
                </button>

                {/* Center: Navigation */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-gray-100 p-1 rounded-lg shadow-sm">
                    <button onClick={handlePrev} className="p-1 px-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500 hover:text-gray-900">
                        ←
                    </button>
                    <button onClick={handleToday} className="px-3 py-1 text-sm font-semibold hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-700">
                        Сегодня
                    </button>
                    <button onClick={handleNext} className="p-1 px-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500 hover:text-gray-900">
                        →
                    </button>
                </div>

                {/* Right: Settings */}
                <Menu as="div" className="relative inline-block text-left">
                    <Menu.Button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200">
                        <Settings size={20} />
                    </Menu.Button>
                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                    >
                        <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-xl bg-white shadow-xl ring-1 ring-black/5 focus:outline-none z-50">
                            <div className="px-4 py-3 border-b border-gray-50">
                                <p className="text-sm font-semibold text-gray-900">Настройки отображения</p>
                            </div>
                            <div className="p-2">
                                <Menu.Item>
                                    {({ active }) => (
                                        <button
                                            onClick={() => setShowCompleted(!showCompleted)}
                                            className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg transition-colors ${active ? 'bg-gray-50' : ''}`}
                                        >
                                            <span className="text-gray-700">Показать завершенные</span>
                                            <div className={`w-9 h-5 rounded-full relative transition-colors ${showCompleted ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${showCompleted ? 'translate-x-4' : ''}`} />
                                            </div>
                                        </button>
                                    )}
                                </Menu.Item>
                            </div>
                        </Menu.Items>
                    </Transition>
                </Menu>
            </div>

            <div ref={calendarContainerRef} className="flex-1 overflow-visible relative daily-planner-wrapper pulse-calendar">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[timeGridPlugin, interactionPlugin]}
                    initialView="timeGridDay"
                    locale={ruLocale}
                    datesSet={(arg) => setCurrentDate(arg.view.currentStart)}
                    headerToolbar={false}
                    allDaySlot={true}
                    slotDuration={ZOOM_LEVELS[zoomIndex]}
                    dayHeaderFormat={{ weekday: 'short', month: 'numeric', day: 'numeric', omitCommas: true }}
                    editable={true}
                    selectable={true}
                    selectMirror={true}
                    expandRows={true}
                    dayMaxEventRows={allDayMaxRows}
                    select={handleDateSelect}
                    eventClick={handleEventClick}
                    eventContent={renderCalendarEventContent}
                    height="100%"
                    events={events}
                    eventOrder="isCompleted,priorityRank,start,-duration,allDay,title"
                    eventOrderStrict={true}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    allDayText="Весь день"
                    nowIndicator={true}
                    slotMinTime={hideNightTime ? "07:00:00" : "00:00:00"}
                    slotMaxTime={hideNightTime ? "23:00:00" : "24:00:00"}
                    scrollTime="08:00:00"
                    slotLabelFormat={{
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }}
                    eventTimeFormat={{
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }}
                    eventClassNames="text-xs font-medium rounded-md px-1 shadow-sm border-0"
                />
            </div>



            <RecurrenceEditModal
                isOpen={recurrenceModalOpen}
                onClose={() => {
                    setRecurrenceModalOpen(false)
                    setPendingCalendarUpdate(null)
                    setAllowedModes(undefined)
                }}
                onConfirm={handleRecurrenceConfirm}
                allowedModes={allowedModes}
                title="Изменение времени повторяющейся задачи"
            />
        </div>
    )
}
