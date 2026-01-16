import { useAllTasks } from "@/hooks/useAllTasks"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { useSettings } from "@/store/useSettings"
import { useCreateTask } from "@/hooks/useCreateTask"
import { useTaskOccurrence } from "@/hooks/useTaskOccurrence"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import multiMonthPlugin from "@fullcalendar/multimonth"
import listPlugin from "@fullcalendar/list"
import ruLocale from '@fullcalendar/core/locales/ru'
import { useSearchParams, useNavigate, useLocation } from "react-router-dom"
import { Loader2, Settings, ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowLeft, ArrowRight, Check } from "lucide-react"
import type { DateSelectArg } from "@fullcalendar/core"
import { supabase } from "@/lib/supabase"
import { useState, useEffect, useRef, Fragment, useMemo } from "react"
import { generateRecurringInstances } from "@/utils/recurrence"
import { useRecurrenceUpdate } from '@/hooks/useRecurrenceUpdate'
import { RecurrenceEditModal } from "@/components/ui/date-picker/RecurrenceEditModal"
import { Menu, Transition } from "@headlessui/react"
import { createPortal } from "react-dom"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { useSwipeable } from "react-swipeable"
import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import clsx from 'clsx'

export function CalendarPage() {
    const location = useLocation()
    const { data, isLoading } = useAllTasks()
    const tasks = data?.tasks
    const occurrencesMap = data?.occurrencesMap
    const { settings } = useSettings()
    const hideNightTime = settings?.preferences?.hide_night_time ?? false
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createTask } = useCreateTask()
    const { setOccurrenceStatus } = useTaskOccurrence()
    const [_, setSearchParams] = useSearchParams()
    const navigate = useNavigate()
    const calendarRef = useRef<FullCalendar>(null)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [currentTitle, setCurrentTitle] = useState('')
    const [currentViewType, setCurrentViewType] = useState('timeGridWeek')
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
    const [isSwiping, setIsSwiping] = useState(false)

    const [currentDate, setCurrentDate] = useState(new Date())

    // Zoom State
    const ZOOM_LEVELS = ['00:15:00', '00:30:00', '01:00:00', '02:00:00', '04:00:00']
    const [zoomIndex, setZoomIndex] = useState(2) // Default 01:00:00
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const container = containerRef.current
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

    // Recurrence Edit Modal State
    const [recurrenceModal, setRecurrenceModal] = useState<{
        isOpen: boolean;
        info: any;
        allowedModes?: ('single' | 'following' | 'all')[];
    }>({ isOpen: false, info: null })

    const [showCompleted, setShowCompleted] = useState(false)

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768
            setIsMobile(mobile)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Sync view when isMobile changes
    useEffect(() => {
        const calendarApi = calendarRef.current?.getApi()
        if (calendarApi) {
            if (isMobile) {
                if (currentViewType !== 'timeGridDay' && currentViewType !== 'listWeek') {
                    calendarApi.changeView('timeGridDay')
                }
            } else {
                if (currentViewType === 'timeGridDay') {
                    calendarApi.changeView('timeGridWeek')
                }
            }
        }
    }, [isMobile])

    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])

    const handleDateSelect = async (selectInfo: DateSelectArg) => {
        const calendarApi = selectInfo.view.calendar
        calendarApi.unselect()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const isAllDay = selectInfo.allDay
        let updates: any = {
            title: 'New Task',
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

        const newId = crypto.randomUUID()
        setSearchParams({ task: newId, isNew: 'true' })

        createTask({ id: newId, ...updates, title: '' })
    }

    if (isLoading && !tasks) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <Loader2 className="animate-spin mr-2" />
                Loading calendar...
            </div>
        )
    }

    const mapTaskToEvent = (task: any) => {
        let start = task.start_time || task.due_date
        let end = task.end_time

        const getDateStr = (value: string | null | undefined) => {
            if (!value) return null
            return value.split('T')[0]
        }

        const originalTaskId = task.original_id || task.id
        const originalTask = tasks?.find(t => t.id === originalTaskId) || task
        const masterDateStr = getDateStr(originalTask.start_time) || getDateStr(originalTask.due_date)
        const occurrenceDateStr = task.occurrence_date || getDateStr(task.start_time) || getDateStr(task.due_date)
        const isMaster = !!task.recurrence_rule && !task.is_virtual && !!masterDateStr && occurrenceDateStr === masterDateStr

        // Priority-based colors
        let backgroundColor = '#94a3b8' // Default Gray (None)
        let borderColor = '#64748b'
        let textColor = '#ffffff'

        if (task.is_completed) {
            backgroundColor = '#f3f4f6' // Very light gray for completed
            borderColor = '#e5e7eb'
            textColor = '#9ca3af'
        } else {
            if (task.priority === 'high') {
                backgroundColor = '#ef4444' // Red
                borderColor = '#dc2626'
            } else if (task.priority === 'medium') {
                backgroundColor = '#fbbf24' // Amber/Light Orange
                borderColor = '#f59e0b'
            } else if (task.priority === 'low') {
                backgroundColor = '#3b82f6' // Blue for Low
                borderColor = '#2563eb'
            }
        }

        const baseTitle = task.title || 'Untitled Task'
        const displayTitle = isMaster ? `[R] ${baseTitle}` : baseTitle

        return {
            id: task.id,
            title: displayTitle,
            start: start || undefined,
            end: end || undefined,
            allDay: !task.start_time,
            backgroundColor,
            borderColor,
            textColor,
            classNames: task.is_completed ? 'is-completed' : '',
            extendedProps: {
                projectId: task.project_id,
                description: task.description,
                isCompleted: task.is_completed,
                originalId: task.original_id || task.id,
                isVirtual: task.is_virtual || false,
                occurrenceDate: task.occurrence_date || null,
                priority: task.priority,
                recurrenceRule: task.recurrence_rule || null,
                isMaster
            }
        }
    }

    const events = useMemo(() => {
        if (!tasks) return []

        const rangeStart = new Date(currentDate)
        rangeStart.setMonth(rangeStart.getMonth() - 2)
        const rangeEnd = new Date(currentDate)
        rangeEnd.setMonth(rangeEnd.getMonth() + 2)

        const allEvents: any[] = []

        tasks.forEach(task => {
            if (!showCompleted && task.is_completed) return

            if (task.recurrence_rule) {
                // 1) Render the master task itself.
                allEvents.push(mapTaskToEvent(task))

                // 2) Render following occurrences, skipping the master date to avoid duplicates.
                const masterDateStr = (task.start_time || task.due_date || '').split('T')[0]
                const instances = generateRecurringInstances(task, rangeStart, rangeEnd, occurrencesMap)
                instances.forEach(instance => {
                    if (!showCompleted && instance.is_completed) return
                    if (instance.occurrence_date === masterDateStr) return
                    allEvents.push(mapTaskToEvent(instance))
                })
            } else {
                allEvents.push(mapTaskToEvent(task))
            }
        })

        allEvents.sort((a, b) => Number(a.extendedProps.isCompleted) - Number(b.extendedProps.isCompleted))
        return allEvents
    }, [tasks, occurrencesMap, currentDate, showCompleted])

    const isTimedEvent = (event: any) => {
        const startStr = event?.startStr
        if (typeof startStr === 'string' && startStr.includes('T')) return true

        const start = event?.start
        const end = event?.end
        if (start && end) {
            const durationMs = end.getTime() - start.getTime()
            if (durationMs > 0 && durationMs < 24 * 60 * 60 * 1000) return true
        }

        if (start) {
            const hasTime =
                start.getHours() !== 0 ||
                start.getMinutes() !== 0 ||
                start.getSeconds() !== 0
            if (hasTime) return true
        }

        return false
    }

    const isAllDayEvent = (event: any) => !isTimedEvent(event)

    const handleEventDrop = (info: any) => {
        if (info.event.extendedProps.isVirtual) {
            const originalId = info.event.extendedProps.originalId
            const occurrenceDate = info.event.extendedProps.occurrenceDate
            const originalTask = tasks?.find(t => t.id === originalId)

            if (originalTask) {
                const eventStartDateStr = info.event.startStr?.split('T')[0] ||
                    (info.event.start ? format(info.event.start, 'yyyy-MM-dd') : null)
                const wasAllDaySeries = !originalTask.start_time
                const isNowTimed = isTimedEvent(info.event)
                const treatAsTimeOnlyChange = wasAllDaySeries && isNowTimed
                const isDateChange = treatAsTimeOnlyChange
                    ? false
                    : (eventStartDateStr ? eventStartDateStr !== occurrenceDate : false)
                const isFirstInstance = occurrenceDate === originalTask.due_date?.split('T')[0]

                let modes: ('single' | 'following' | 'all')[] = []
                if (isDateChange) {
                    modes = ['single', 'following']
                } else if (isFirstInstance) {
                    modes = ['single', 'all']
                } else {
                    modes = ['single', 'following', 'all']
                }
                setRecurrenceModal({ isOpen: true, info, allowedModes: modes })
                return
            }
        }

        const taskId = info.event.id
        const isAllDay = isAllDayEvent(info.event)

        if (isAllDay && info.event.start) {
            const dateStr = format(info.event.start, 'yyyy-MM-dd')
            updateTask({
                taskId,
                updates: {
                    start_time: null,
                    end_time: null,
                    due_date: dateStr
                }
            })
        } else {
            const newStart = info.event.start?.toISOString() || null
            const newEnd = info.event.end?.toISOString() || null
            let dateStr = info.event.start ? format(info.event.start, 'yyyy-MM-dd') : null

            updateTask({
                taskId,
                updates: {
                    start_time: newStart,
                    end_time: newEnd,
                    due_date: dateStr
                }
            })
        }
    }

    const handleEventResize = (info: any) => {
        if (info.event.extendedProps.isVirtual) {
            const originalId = info.event.extendedProps.originalId
            const occurrenceDate = info.event.extendedProps.occurrenceDate
            const originalTask = tasks?.find(t => t.id === originalId)

            if (originalTask) {
                const isFirstInstance = occurrenceDate === originalTask.due_date?.split('T')[0]
                const modes: ('single' | 'following' | 'all')[] = isFirstInstance ? ['single', 'all'] : ['single', 'following', 'all']

                setRecurrenceModal({ isOpen: true, info, allowedModes: modes })
                return
            }
        }

        const taskId = info.event.id
        const newStart = info.event.start?.toISOString() || null
        const newEnd = info.event.end?.toISOString() || null

        updateTask({
            taskId,
            updates: {
                start_time: newStart,
                end_time: newEnd
            }
        })
    }

    const { confirmRecurrenceUpdate } = useRecurrenceUpdate()

    const handleRecurrenceConfirm = async (mode: 'single' | 'following' | 'all') => {
        const { info } = recurrenceModal
        if (!info) return

        const event = info.event
        const originalId = event.extendedProps.originalId
        const occurrenceDate = event.extendedProps.occurrenceDate
        const originalTask = tasks?.find(t => t.id === originalId)

        if (!originalTask || !occurrenceDate) {
            info.revert();
            setRecurrenceModal({ isOpen: false, info: null });
            return;
        }

        const isAllDay = isAllDayEvent(event)
        const newStart = event.start
        const newEnd = event.end
        let dateStr = newStart ? format(newStart, 'yyyy-MM-dd') : null

        // If it's All Day, we MUST clear the times
        let finalStartTime = isAllDay ? null : (newStart?.toISOString() || null)
        let finalEndTime = isAllDay ? null : (newEnd?.toISOString() || null)

        // If dragging a virtual occurrence and choosing "all",
        // keep the master series date anchored.
        if (mode === 'all' && event.extendedProps.isVirtual && originalTask) {
            const masterDateStr = originalTask.start_time
                ? originalTask.start_time.split('T')[0]
                : (originalTask.due_date || '').split('T')[0]
            if (masterDateStr) {
                dateStr = masterDateStr
                if (!isAllDay && newStart) {
                    const timePart = newStart.toISOString().split('T')[1]
                    // Re-anchor start/end to master date to avoid shifting series start.
                    const anchoredStart = `${masterDateStr}T${timePart}`
                    const anchoredStartMs = new Date(anchoredStart).getTime()
                    const durationMs = newEnd && newStart ? (newEnd.getTime() - newStart.getTime()) : null
                    const anchoredEnd = durationMs !== null
                        ? new Date(anchoredStartMs + durationMs).toISOString()
                        : null
                    finalStartTime = anchoredStart
                    finalEndTime = anchoredEnd
                }
            }
        }

        await confirmRecurrenceUpdate({
            task: originalTask,
            mode,
            occurrenceDate,
            updates: {
                start_time: finalStartTime,
                end_time: finalEndTime,
                due_date: dateStr
            }
        })

        setRecurrenceModal({ isOpen: false, info: null })
    }

    const handleEventClick = (info: any) => {
        const popover = document.querySelector('.fc-popover')
        if (popover) {
            const closeBtn = popover.querySelector('.fc-popover-close')
            if (closeBtn instanceof HTMLElement) {
                closeBtn.click()
            } else {
                (popover as HTMLElement).remove()
            }
        }

        const params: any = { task: info.event.extendedProps.originalId }
        if (info.event.extendedProps.isVirtual) {
            params.occurrence = info.event.extendedProps.occurrenceDate
        }
        setSearchParams(params)
    }

    const x = useMotionValue(0)
    const opacity = useTransform(x, [-200, 0, 200], [0.5, 1, 0.5])

    // Helper to animate view switches
    const animateViewSwitch = async (newView: string, direction: 'left' | 'right') => {
        const targetX = direction === 'left' ? -window.innerWidth : window.innerWidth

        // Animate out
        await animate(x, targetX, { duration: 0.2 }).then(() => {
            calendarRef.current?.getApi().changeView(newView)

            // Set starting position for animation in (from opposite side)
            x.set(-targetX)

            // Animate in
            animate(x, 0, { duration: 0.3, type: "spring", stiffness: 300, damping: 30 })
        })
    }

    const headerGoPrev = () => calendarRef.current?.getApi().prev()
    const headerGoNext = () => calendarRef.current?.getApi().next()
    const headerGoToday = () => calendarRef.current?.getApi().today()
    const headerChangeView = (view: string) => {
        if (view === currentViewType) return

        // Simple transition for standard view switches
        calendarRef.current?.getApi().changeView(view)
    }

    // Swipe handling
    const handleSwipeComplete = async (direction: 'left' | 'right') => {
        const targetX = direction === 'left' ? -window.innerWidth : window.innerWidth

        // Animate out
        await animate(x, targetX, { duration: 0.2 }).then(() => {
            // Update calendar view
            if (direction === 'left') {
                headerGoNext()
            } else {
                headerGoPrev()
            }

            // Instantly jump to other side
            x.set(-targetX)

            // Animate in
            animate(x, 0, { duration: 0.3, type: "spring", stiffness: 300, damping: 30 })
            setIsSwiping(false)
        })
    }

    const handlers = useSwipeable({
        onSwiping: (e) => {
            // Only handle horizontal swipe if it's the dominant direction
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                setIsSwiping(true)
                x.set(e.deltaX)
            }
        },
        onSwipedLeft: () => handleSwipeComplete('left'),
        onSwipedRight: () => handleSwipeComplete('right'),
        onSwiped: (e) => {
            // Snap back if threshold not met or if it wasn't a horizontal swipe
            if (Math.abs(e.deltaX) < 100 || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                animate(x, 0, { type: "spring", stiffness: 400, damping: 40 })
                setIsSwiping(false)
            }
        },
        delta: 10,
        preventScrollOnSwipe: false, // Allow vertical scrolling
        trackMouse: false,
        trackTouch: true
    })

    const { ref: swipeRef, ...swipeHandlers } = handlers

    const handleDateSelectWrapper = (arg: any) => {
        if (isSwiping) return
        handleDateSelect(arg)
    }

    const handleEventClickWrapper = (arg: any) => {
        if (isSwiping) return
        handleEventClick(arg)
    }

    const renderEventContent = (eventInfo: any) => {
        const { timeText, event } = eventInfo
        const isCompleted = event.extendedProps.isCompleted
        const isMaster = !!event.extendedProps.isMaster

        const contentClasses = clsx(
            "flex flex-col w-full h-full px-0.5 py-0 leading-none overflow-hidden",
            isCompleted && "opacity-75"
        )

        const titleClasses = clsx(
            "text-xs font-semibold truncate shrink-0 mb-0.5",
            isCompleted ? "text-gray-400 line-through decoration-gray-300" : ""
        )

        if (eventInfo.view.type.startsWith('list')) {
            return (
                <div className="flex items-center gap-2">
                    <span className={titleClasses}>{event.title}</span>
                    {timeText && <span className="text-gray-500 text-xs">({timeText})</span>}
                </div>
            )
        }

        return (
            <div className={contentClasses} style={isCompleted ? { color: '#9ca3af' } : {}}>
                <div className={titleClasses}>{event.title}</div>
                {timeText && <div className="text-[10px] opacity-80 truncate min-h-0 shrink">{timeText}</div>}
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col bg-white p-0 md:p-4 relative overflow-hidden">
            <RecurrenceEditModal
                isOpen={recurrenceModal.isOpen}
                onClose={() => {
                    recurrenceModal.info?.revert();
                    setRecurrenceModal({ isOpen: false, info: null });
                }}
                onConfirm={handleRecurrenceConfirm}
                allowedModes={recurrenceModal.allowedModes}
            />

            {/* Unified Custom Header (Desktop Only) */}
            {!isMobile && (
                <div className="flex items-center justify-between gap-4 mb-4 shrink-0 px-4 md:px-0 relative min-h-[40px]">
                    {/* Left: Collapse Button */}
                    <div className="flex items-center z-10">
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-all"
                            title="Collapse"
                        >
                            <span>Свернуть календарь</span>
                            <ArrowRight size={16} />
                        </button>
                    </div>

                    {/* Center: Navigation & Title */}
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 z-0 pointer-events-none">
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg pointer-events-auto shadow-sm">
                            <button onClick={headerGoPrev} className="p-1 px-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500 hover:text-gray-900">
                                <span className="sr-only">Prev</span>←
                            </button>
                            <button onClick={headerGoToday} className="px-3 py-1 text-sm font-semibold hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-700">
                                Сегодня
                            </button>
                            <button onClick={headerGoNext} className="p-1 px-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500 hover:text-gray-900">
                                <span className="sr-only">Next</span>→
                            </button>
                        </div>



                        {/* Special Show Week Button for List View */}
                        {currentViewType === 'listWeek' && (
                            <button
                                onClick={() => animateViewSwitch('timeGridWeek', 'left')}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-semibold transition-colors animate-in fade-in pointer-events-auto"
                            >
                                <CalendarIcon size={16} />
                                Показать неделю
                            </button>
                        )}
                    </div>

                    {/* Right: Settings Only */}
                    <div className="flex items-center justify-end z-10 w-10">
                        {/* Settings Menu */}
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
                </div>
            )}

            {/* Mobile Header Portals */}
            {isMobile && mounted && location.pathname.startsWith('/calendar') && document.getElementById('mobile-header-title') && createPortal(
                <div className="flex items-center justify-center">
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm divide-x divide-gray-200">
                        <button
                            onClick={headerGoPrev}
                            className="py-2 px-5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-l-lg active:bg-gray-100 transition-all"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <button
                            onClick={headerGoToday}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                        >
                            Сегодня
                        </button>

                        <button
                            onClick={headerGoNext}
                            className="py-2 px-5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-r-lg active:bg-gray-100 transition-all"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>,
                document.getElementById('mobile-header-title')!
            )}

            {isMobile && mounted && location.pathname.startsWith('/calendar') && document.getElementById('mobile-header-right') && createPortal(
                <Menu as="div" className="relative inline-block text-left">
                    <Menu.Button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
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
                        <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-xl bg-white shadow-xl ring-1 ring-black/5 focus:outline-none z-[60]">
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
                            <div className="p-2 border-t border-gray-100">
                                <div className="px-2 py-1.5">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Вид</p>
                                </div>
                                {[
                                    { id: 'timeGridDay', label: '1 День' },
                                    { id: 'threeDay', label: '3 Дня' },
                                    { id: 'timeGridWeek', label: 'Неделя' }
                                ].map(view => (
                                    <Menu.Item key={view.id}>
                                        {({ active }) => (
                                            <button
                                                onClick={() => headerChangeView(view.id)}
                                                className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg transition-colors ${active ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                                            >
                                                <span className={currentViewType === view.id ? 'font-medium text-gray-900' : 'text-gray-600'}>
                                                    {view.label}
                                                </span>
                                                {currentViewType === view.id && <Check size={16} className="text-blue-600" />}
                                            </button>
                                        )}
                                    </Menu.Item>
                                ))}
                            </div>
                        </Menu.Items>
                    </Transition>
                </Menu>,
                document.getElementById('mobile-header-right')!
            )}



            <motion.div
                ref={(node) => {
                    // Merge refs: react-swipeable needs the ref, and we need it for zoom
                    swipeRef(node)
                    // @ts-ignore
                    containerRef.current = node
                }}
                className="flex-1 min-h-0 relative touch-pan-y"
                {...swipeHandlers}
                style={{ x, opacity }}
            >
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, multiMonthPlugin, listPlugin]}
                    headerToolbar={false}
                    locale={ruLocale}
                    views={{
                        dayGridMonth: { // Ensure this exists for the separate button
                            titleFormat: { month: 'long', year: 'numeric' }
                        },
                        threeDay: {
                            type: 'timeGrid',
                            duration: { days: 3 },
                            buttonText: '3 Дня',
                            titleFormat: { month: 'short', day: 'numeric' },
                            dayHeaderFormat: { weekday: 'short', month: 'numeric', day: 'numeric', omitCommas: false }
                        },
                        timeGridDay: {
                            titleFormat: { month: 'long', day: 'numeric' },
                            dayHeaderFormat: { weekday: 'long', month: 'long', day: 'numeric', omitCommas: false }
                        },
                        timeGridWeek: {
                            titleFormat: { month: 'short', day: 'numeric' }
                        },
                        listWeek: {
                            titleFormat: { month: 'short', day: 'numeric' }
                        }
                    }}
                    initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
                    firstDay={1}
                    editable={true}
                    selectable={true}
                    selectMirror={true}
                    expandRows={true}
                    select={handleDateSelectWrapper}
                    datesSet={(arg) => {
                        setCurrentTitle(arg.view.title)
                        setCurrentViewType(arg.view.type)
                        setCurrentDate(arg.view.currentStart)
                    }}
                    eventOrder="extendedProps.isCompleted,start,-duration,allDay,title"
                    height="100%"
                    events={events}
                    eventContent={renderEventContent}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    eventClick={handleEventClickWrapper}
                    nowIndicator={true}
                    allDayText="Весь день"
                    slotMinTime={hideNightTime ? "07:00:00" : "00:00:00"}
                    slotMaxTime={hideNightTime ? "23:00:00" : "24:00:00"}
                    slotDuration={ZOOM_LEVELS[zoomIndex]}
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
                />
            </motion.div>
        </div>
    )
}
