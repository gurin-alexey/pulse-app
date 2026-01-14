import { useState, useEffect, Fragment, useRef, useMemo } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { format, isToday, subMonths, addMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import ruLocale from '@fullcalendar/core/locales/ru'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Loader2, Calendar, ArrowLeft, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { DateSelectArg } from "@fullcalendar/core"
import clsx from 'clsx'

import { useAllTasks } from '@/hooks/useAllTasks'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useCreateTask } from '@/hooks/useCreateTask'
import { useSettings } from "@/store/useSettings"
import { supabase } from '@/lib/supabase'

import { generateRecurringInstances } from '@/utils/recurrence'
import { RecurrenceEditModal } from "@/components/ui/date-picker/RecurrenceEditModal"
import { useTaskOccurrence } from '@/hooks/useTaskOccurrence'
import { useRecurrenceUpdate } from '@/hooks/useRecurrenceUpdate'

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

    const [_, setSearchParams] = useSearchParams()
    const navigate = useNavigate()
    const { settings } = useSettings()
    const hideNightTime = settings?.preferences?.hide_night_time ?? false

    const calendarRef = useRef<FullCalendar>(null)
    const [currentDate, setCurrentDate] = useState(new Date())

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
        if (!tasks) return []

        const expandedEvents: any[] = []
        const rangeStart = subMonths(currentDate, 3)
        const rangeEnd = addMonths(currentDate, 3)

        tasks.forEach(task => {
            let instances: any[] = []
            if (task.recurrence_rule) {
                instances = generateRecurringInstances(task, rangeStart, rangeEnd, occurrencesMap)
            } else {
                instances = [task]
            }

            instances.forEach(t => {
                if (!showCompleted && t.is_completed) return

                let start = t.start_time || t.due_date
                let end = t.end_time

                let bg = '', border = '', text = ''
                if (t.is_completed) {
                    bg = '#f3f4f6'; border = '#e5e7eb'; text = '#9ca3af'
                } else {
                    switch (t.priority) {
                        case 'high': bg = '#fee2e2'; border = '#f87171'; text = '#b91c1c'; break;
                        case 'medium': bg = '#ffedd5'; border = '#fb923c'; text = '#c2410c'; break;
                        case 'low': bg = '#dbeafe'; border = '#60a5fa'; text = '#1d4ed8'; break;
                        default: bg = '#f3f4f6'; border = '#9ca3af'; text = '#374151'; break;
                    }
                }

                expandedEvents.push({
                    id: t.id,
                    title: t.title,
                    start: start || undefined,
                    end: end || undefined,
                    allDay: !t.start_time,
                    backgroundColor: bg,
                    borderColor: border,
                    textColor: text,
                    classNames: clsx(t.is_completed && "opacity-75 line-through decoration-gray-400"),
                    extendedProps: {
                        occurrence: t.occurrence_date,
                        originalId: t.original_id || t.id
                    }
                })
            })
        })

        return expandedEvents
    }, [tasks, occurrencesMap, currentDate, showCompleted])

    if (isLoading) {
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

        const occurrence = info.event.extendedProps?.occurrence
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
    }

    const handleEventDrop = (info: EventDropArg) => {
        let taskId = info.event.extendedProps?.originalId || info.event.extendedProps?.original_id || info.event.id
        if (taskId && taskId.includes('_recur_')) {
            taskId = taskId.split('_recur_')[0]
        }

        // Check if task is recurring
        const task = tasks?.find(t => t.id === taskId)
        const isRecurring = !!task?.recurrence_rule
        const occurrence = info.event.extendedProps?.occurrence

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
        const occurrence = info.event.extendedProps?.occurrence

        const updates = {
            start_time: info.event.start?.toISOString() || null,
            end_time: info.event.end?.toISOString() || null
        }

        if (isRecurring && occurrence) {
            info.revert()
            setPendingCalendarUpdate({ taskId, updates, occurrenceDate: occurrence })
            setRecurrenceModalOpen(true)
        } else {
            updateTask({ taskId, updates })
        }
    }


    return (
        <div className="h-full flex flex-col bg-white overflow-hidden relative">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 z-10 shrink-0">
                <button
                    onClick={() => navigate('/calendar')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 border border-blue-100 shadow-sm hover:bg-blue-100 transition-all"
                >
                    <ArrowLeft size={16} />
                    Показать неделю
                </button>

                <div className="flex items-center gap-2">
                    <button onClick={handlePrev} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={handleToday}
                        className="p-2 hover:bg-gray-50 rounded-full transition-all group"
                        title="Вернуться к сегодня"
                    >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isToday(currentDate) ? 'border-slate-500' : 'border-gray-300 group-hover:border-gray-400'
                            }`}>
                            <div className={`w-1.5 h-1.5 rounded-full transition-all ${isToday(currentDate) ? 'bg-slate-500' : 'bg-transparent'
                                }`} />
                        </div>
                    </button>
                    <button onClick={handleNext} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                        <ChevronRight size={18} />
                    </button>
                </div>

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

            <div className="flex-1 overflow-hidden relative daily-planner-wrapper">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[timeGridPlugin, interactionPlugin]}
                    initialView="timeGridDay"
                    locale={ruLocale}
                    datesSet={(arg) => setCurrentDate(arg.view.currentStart)}
                    headerToolbar={false}
                    allDaySlot={true}
                    slotDuration="00:30:00"
                    slotLabelInterval="01:00"
                    dayHeaderFormat={{ weekday: 'short', month: 'numeric', day: 'numeric', omitCommas: true }}
                    editable={true}
                    selectable={true}
                    selectMirror={true}
                    select={handleDateSelect}
                    eventClick={handleEventClick}
                    height="100%"
                    events={events}
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
                }}
                onConfirm={handleRecurrenceConfirm}
                title="Изменение времени повторяющейся задачи"
            />
        </div>
    )
}
