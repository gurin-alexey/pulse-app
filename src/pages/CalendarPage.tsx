import { useAllTasks } from "@/hooks/useAllTasks"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { useSettings } from "@/store/useSettings"
import { useCreateTask } from "@/hooks/useCreateTask"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import multiMonthPlugin from "@fullcalendar/multimonth"
import listPlugin from "@fullcalendar/list"
import ruLocale from '@fullcalendar/core/locales/ru'
import { useSearchParams, useNavigate } from "react-router-dom"
import { Loader2, Settings, ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowLeft, ArrowRight } from "lucide-react"
import type { DateSelectArg } from "@fullcalendar/core"
import { supabase } from "@/lib/supabase"
import { useState, useEffect, useRef, Fragment } from "react"
import { generateRecurringInstances, addExDateToRRule, addUntilToRRule, updateDTStartInRRule } from "@/utils/recurrence"
import { RecurrenceEditModal } from "@/components/ui/date-picker/RecurrenceEditModal"
import { Menu, Transition } from "@headlessui/react"
import { createPortal } from "react-dom"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { useSwipeable } from "react-swipeable"
import { motion, useMotionValue, useTransform, animate } from "framer-motion"

export function CalendarPage() {
    const { data, isLoading } = useAllTasks()
    const tasks = data?.tasks
    const occurrencesMap = data?.occurrencesMap
    const { settings } = useSettings()
    const hideNightTime = settings?.preferences?.hide_night_time ?? false
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createTask } = useCreateTask()
    const [_, setSearchParams] = useSearchParams()
    const navigate = useNavigate()
    const calendarRef = useRef<FullCalendar>(null)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [currentTitle, setCurrentTitle] = useState('')
    const [currentViewType, setCurrentViewType] = useState('timeGridWeek')
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
    const [isSwiping, setIsSwiping] = useState(false)

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
    }>({ isOpen: false, info: null })

    const [showCompleted, setShowCompleted] = useState(true)

    // Refetch events when tasks data changes
    useEffect(() => {
        calendarRef.current?.getApi().refetchEvents()
    }, [tasks, showCompleted])

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

    if (isLoading) {
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

        return {
            id: task.id,
            title: task.title || 'Untitled Task',
            start: start || undefined,
            end: end || undefined,
            allDay: !task.start_time,
            backgroundColor,
            borderColor,
            textColor,
            extendedProps: {
                projectId: task.project_id,
                description: task.description,
                isCompleted: task.is_completed,
                originalId: task.original_id || task.id,
                isVirtual: task.is_virtual || false,
                occurrenceDate: task.occurrence_date || null,
                priority: task.priority
            }
        }
    }

    const handleFetchEvents = (fetchInfo: any, successCallback: any) => {
        if (!tasks) return successCallback([])

        const start = fetchInfo.start
        const end = fetchInfo.end

        const allEvents: any[] = []

        tasks.forEach(task => {
            if (!showCompleted && task.is_completed) return

            if (task.recurrence_rule) {
                const instances = generateRecurringInstances(task, start, end, occurrencesMap)
                instances.forEach(instance => {
                    if (!showCompleted && instance.is_completed) return
                    allEvents.push(mapTaskToEvent(instance))
                })
            } else {
                allEvents.push(mapTaskToEvent(task))
            }
        })

        allEvents.sort((a, b) => Number(a.extendedProps.isCompleted) - Number(b.extendedProps.isCompleted))

        successCallback(allEvents)
    }

    const handleEventDrop = (info: any) => {
        if (info.event.extendedProps.isVirtual) {
            setRecurrenceModal({ isOpen: true, info })
            return
        }

        const taskId = info.event.id
        const isAllDay = info.event.allDay

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
            setRecurrenceModal({ isOpen: true, info })
            return
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

    const handleRecurrenceConfirm = (mode: 'single' | 'following' | 'all') => {
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

        const isAllDay = event.allDay
        const newStart = event.start
        const newEnd = event.end
        const dateStr = newStart ? format(newStart, 'yyyy-MM-dd') : null

        // If it's All Day, we MUST clear the times
        const finalStartTime = isAllDay ? null : (newStart?.toISOString() || null)
        const finalEndTime = isAllDay ? null : (newEnd?.toISOString() || null)

        if (mode === 'single') {
            const newRule = addExDateToRRule(originalTask.recurrence_rule || '', new Date(occurrenceDate))
            updateTask({ taskId: originalId, updates: { recurrence_rule: newRule } })

            createTask({
                title: originalTask.title,
                description: originalTask.description,
                priority: originalTask.priority,
                projectId: originalTask.project_id,
                userId: originalTask.user_id,
                due_date: dateStr,
                start_time: finalStartTime,
                end_time: finalEndTime
            })
        }
        else if (mode === 'following') {
            const prevDay = new Date(new Date(occurrenceDate).getTime() - 86400000)
            const oldRuleEnd = addUntilToRRule(originalTask.recurrence_rule || '', prevDay)
            updateTask({ taskId: originalId, updates: { recurrence_rule: oldRuleEnd } })

            const newRule = updateDTStartInRRule(originalTask.recurrence_rule || '', newStart || new Date())

            createTask({
                title: originalTask.title,
                description: originalTask.description,
                priority: originalTask.priority,
                projectId: originalTask.project_id,
                userId: originalTask.user_id,
                due_date: dateStr,
                start_time: finalStartTime,
                end_time: finalEndTime,
                recurrence_rule: newRule
            })
        }
        else if (mode === 'all') {
            const newRule = updateDTStartInRRule(originalTask.recurrence_rule || '', newStart || new Date())

            updateTask({
                taskId: originalId,
                updates: {
                    start_time: finalStartTime,
                    end_time: finalEndTime,
                    due_date: dateStr,
                    recurrence_rule: newRule
                }
            })
        }

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

    return (
        <div className="h-full flex flex-col bg-white p-0 md:p-4 relative overflow-hidden">
            <RecurrenceEditModal
                isOpen={recurrenceModal.isOpen}
                onClose={() => {
                    recurrenceModal.info?.revert();
                    setRecurrenceModal({ isOpen: false, info: null });
                }}
                onConfirm={handleRecurrenceConfirm}
            />

            {/* Unified Custom Header (Desktop Only) */}
            {!isMobile && (
                <div className="flex items-center justify-between gap-4 mb-4 shrink-0 px-4 md:px-0 relative min-h-[40px]">
                    {/* Left: Collapse Button */}
                    <div className="flex items-center z-10">
                        <button
                            onClick={() => navigate(-1)}
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
            {isMobile && mounted && document.getElementById('mobile-header-title') && createPortal(
                <div className="flex items-center justify-center gap-1">
                    <button
                        onClick={headerGoPrev}
                        className="p-1 text-gray-400 hover:text-gray-600 active:scale-95 transition-transform"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <button
                        onClick={headerGoToday}
                        className="text-lg truncate flex items-center active:opacity-70 transition-opacity mx-1"
                    >
                        <span className="font-medium text-gray-500 mr-1.5">сегодня</span>
                        <span className="font-bold text-gray-900">{format(new Date(), 'd MMMM', { locale: ru })}</span>
                        <span className="font-medium text-gray-500">, {format(new Date(), 'EEEE', { locale: ru }).toLowerCase()}</span>
                    </button>

                    <button
                        onClick={headerGoNext}
                        className="p-1 text-gray-400 hover:text-gray-600 active:scale-95 transition-transform"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>,
                document.getElementById('mobile-header-title')!
            )}

            {isMobile && mounted && document.getElementById('mobile-header-right') && createPortal(
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
                        </Menu.Items>
                    </Transition>
                </Menu>,
                document.getElementById('mobile-header-right')!
            )}

            {isMobile && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 shadow-xl bg-white p-1.5 rounded-2xl border border-gray-100 flex gap-1 w-auto min-w-[280px]">
                    <button
                        onClick={() => headerChangeView('timeGridDay')}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-xl transition-all ${currentViewType === 'timeGridDay' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                    >
                        1 День
                    </button>
                    <button
                        onClick={() => headerChangeView('threeDay')}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-xl transition-all ${currentViewType === 'threeDay' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                    >
                        3 Дня
                    </button>
                    <button
                        onClick={() => headerChangeView('timeGridWeek')}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-xl transition-all ${currentViewType === 'timeGridWeek' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                    >
                        Неделя
                    </button>
                </div>
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
                            titleFormat: { month: 'short', day: 'numeric' }
                        },
                        timeGridDay: {
                            titleFormat: { month: 'long', day: 'numeric' }
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
                    }}
                    eventOrder="extendedProps.isCompleted,start,-duration,allDay,title"
                    height="100%"
                    events={handleFetchEvents}
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
