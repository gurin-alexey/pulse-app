import { useAllTasks } from "@/hooks/useAllTasks"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { useCreateTask } from "@/hooks/useCreateTask"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import multiMonthPlugin from "@fullcalendar/multimonth"
import { useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import type { DateSelectArg } from "@fullcalendar/core"
import { supabase } from "@/lib/supabase"
import { useState, useEffect, useRef } from "react"
import { generateRecurringInstances } from "@/utils/recurrence"

export function CalendarPage() {
    const { data: tasks, isLoading } = useAllTasks()
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createTask } = useCreateTask()
    const [_, setSearchParams] = useSearchParams()
    const calendarRef = useRef<FullCalendar>(null)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [currentTitle, setCurrentTitle] = useState('')
    const [currentViewType, setCurrentViewType] = useState('timeGridDay')

    // Refetch events when tasks data changes
    useEffect(() => {
        calendarRef.current?.getApi().refetchEvents()
    }, [tasks])

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
                calendarApi.changeView('timeGridDay')
            } else {
                calendarApi.changeView('timeGridWeek')
            }
        }
    }, [isMobile])

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

        // Create with empty title immediately
        createTask({ ...updates, title: '' }, {
            onSuccess: (newTask) => {
                setSearchParams({ task: newTask.id, isNew: 'true' })
            }
        })
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

        return {
            id: task.id,
            title: task.title || 'Untitled Task',
            start: start || undefined,
            end: end || undefined,
            allDay: !task.start_time,
            backgroundColor: task.is_completed ? '#e5e7eb' : '#3b82f6',
            borderColor: task.is_completed ? '#d1d5db' : '#2563eb',
            textColor: task.is_completed ? '#9ca3af' : '#ffffff',
            extendedProps: {
                projectId: task.project_id,
                description: task.description,
                isCompleted: task.is_completed,
                originalId: task.original_id || task.id,
                isVirtual: task.is_virtual || false
            }
        }
    }

    const handleFetchEvents = (fetchInfo: any, successCallback: any) => {
        if (!tasks) return successCallback([])

        const start = fetchInfo.start
        const end = fetchInfo.end

        const allEvents: any[] = []

        tasks.forEach(task => {
            if (task.recurrence_rule) {
                const instances = generateRecurringInstances(task, start, end)
                instances.forEach(instance => {
                    allEvents.push(mapTaskToEvent(instance))
                })
            } else {
                allEvents.push(mapTaskToEvent(task))
            }
        })

        // Sort: incomplete first
        allEvents.sort((a, b) => Number(a.extendedProps.isCompleted) - Number(b.extendedProps.isCompleted))

        successCallback(allEvents)
    }

    const handleEventDrop = (info: any) => {
        // If virtual, we probably want to update the master task's recurrence or move THIS specific instance.
        // Moving a specific instance of a recurring task usually requires creating an "exception".
        // For MVP, we'll inhibit moving virtual instances or just move the master (which moves ALL future ones).
        // Best for now: open detail view.
        if (info.event.extendedProps.isVirtual) {
            info.revert()
            setSearchParams({ task: info.event.extendedProps.originalId })
            return
        }

        const taskId = info.event.id
        const isAllDay = info.event.allDay

        if (isAllDay && info.event.start) {
            const d = info.event.start
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            const dateStr = `${year}-${month}-${day}`

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

            // Fix: due_date must be YYYY-MM-DD (Local), not ISO string with time
            let dateStr = null
            if (info.event.start) {
                const d = info.event.start
                const year = d.getFullYear()
                const month = String(d.getMonth() + 1).padStart(2, '0')
                const day = String(d.getDate()).padStart(2, '0')
                dateStr = `${year}-${month}-${day}`
            }

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
            info.revert()
            setSearchParams({ task: info.event.extendedProps.originalId })
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

    const handleEventClick = (info: any) => {
        // Close "more" popover if open
        const popover = document.querySelector('.fc-popover')
        if (popover) {
            const closeBtn = popover.querySelector('.fc-popover-close')
            if (closeBtn instanceof HTMLElement) {
                closeBtn.click()
            } else {
                (popover as HTMLElement).remove() // Fallback
            }
        }
        setSearchParams({ task: info.event.extendedProps.originalId })
    }

    // Custom Mobile Header Handlers
    const headerGoPrev = () => calendarRef.current?.getApi().prev()
    const headerGoNext = () => calendarRef.current?.getApi().next()
    const headerGoToday = () => calendarRef.current?.getApi().today()
    const headerChangeView = (view: string) => calendarRef.current?.getApi().changeView(view)

    return (
        <div className="h-full flex flex-col bg-white p-0 md:p-4 relative">

            {/* Custom Mobile Header */}
            {isMobile && (
                <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shrink-0 z-10">
                    <div className="flex items-center gap-2">
                        <button onClick={headerGoPrev} className="p-1 text-gray-400 hover:bg-gray-50 rounded"><span className="sr-only">Prev</span>←</button>
                        <button onClick={headerGoToday} className="text-lg font-bold text-gray-800 active:opacity-50 transition-opacity">
                            {currentTitle || 'Calendar'}
                        </button>
                        <button onClick={headerGoNext} className="p-1 text-gray-400 hover:bg-gray-50 rounded"><span className="sr-only">Next</span>→</button>
                    </div>

                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => headerChangeView('timeGridDay')}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${currentViewType === 'timeGridDay' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                        >1D</button>
                        <button
                            onClick={() => headerChangeView('threeDay')}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${currentViewType === 'threeDay' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                        >3D</button>
                        <button
                            onClick={() => headerChangeView('timeGridWeek')}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${currentViewType === 'timeGridWeek' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                        >7D</button>
                    </div>
                </div>
            )}

            <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, multiMonthPlugin]}
                headerToolbar={isMobile ? false : {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                views={{
                    threeDay: {
                        type: 'timeGrid',
                        duration: { days: 3 },
                        buttonText: '3 Days',
                        titleFormat: { month: 'short', day: 'numeric' } // No Year
                    },
                    timeGridDay: {
                        titleFormat: { month: 'short', day: 'numeric' } // No Year on Mobile
                    },
                    timeGridWeek: {
                        titleFormat: { month: 'short', day: 'numeric' }
                    }
                }}
                initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
                firstDay={1}
                editable={true}
                selectable={true}
                selectMirror={true}
                select={handleDateSelect}
                datesSet={(arg) => {
                    setCurrentTitle(arg.view.title)
                    setCurrentViewType(arg.view.type)
                }}
                eventOrder="extendedProps.isCompleted,start,-duration,allDay,title"
                height="100%"
                events={handleFetchEvents}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventClick={handleEventClick}
                nowIndicator={true}
                slotDuration="00:30:00"
                scrollTime="08:00:00"
            />
        </div>
    )
}
