import { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useAllTasks } from '@/hooks/useAllTasks'
import { Loader2 } from 'lucide-react'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useCreateTask } from '@/hooks/useCreateTask'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { DateSelectArg } from "@fullcalendar/core"
import { TaskDetail } from "@/features/tasks/TaskDetail"
import clsx from 'clsx'
import { useSettings } from "@/store/useSettings"

// Manually define the type if it's missing or named differently in this version
interface EventDropArg {
    event: any
    // ... other props if needed
}
import './calendar.css' // We'll create this for custom styling if needed


export function DailyPlanner() {
    const { data: tasks, isLoading } = useAllTasks()
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createTask } = useCreateTask()
    const [_, setSearchParams] = useSearchParams()
    const { settings } = useSettings()
    const hideNightTime = settings?.preferences?.hide_night_time ?? false

    const [showCompleted, setShowCompleted] = useState(false)
    const [popup, setPopup] = useState<{ taskId: string, x: number, y: number } | null>(null)

    // Close popup on escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPopup(null)
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [])

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <Loader2 className="animate-spin mr-2" />
                Loading schedule...
            </div>
        )
    }

    const filteredTasks = tasks?.filter(t => showCompleted || !t.is_completed) || []

    const events = filteredTasks.map(task => {
        // Fallback logic: if start_time is missing, try due_date
        let start = task.start_time || task.due_date
        let end = task.end_time

        // Match CalendarPage Priority Colors
        let bg = ''
        let border = ''
        let text = ''

        if (task.is_completed) {
            bg = '#f3f4f6'
            border = '#e5e7eb'
            text = '#9ca3af'
        } else {
            switch (task.priority) {
                case 'high':
                    bg = '#fee2e2' // red-100
                    border = '#f87171' // red-400
                    text = '#b91c1c' // red-700
                    break
                case 'medium':
                    bg = '#ffedd5' // orange-100
                    border = '#fb923c' // orange-400
                    text = '#c2410c' // orange-700
                    break
                case 'low':
                    bg = '#dbeafe' // blue-100
                    border = '#60a5fa' // blue-400
                    text = '#1d4ed8' // blue-700
                    break
                default: // none/normal
                    bg = '#f3f4f6' // gray-100
                    border = '#9ca3af' // gray-400
                    text = '#374151' // gray-700
            }
        }

        return {
            id: task.id,
            title: task.title,
            start: start || undefined,
            end: end || undefined,
            allDay: !task.start_time,
            backgroundColor: bg,
            borderColor: border,
            textColor: text,
            classNames: clsx(task.is_completed && "opacity-75 line-through decoration-gray-400")
        }
    })

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

        createTask(updates, {
            onSuccess: (newTask) => {
                // Determine position for popup (center of selection roughly, or just mouse pos if available? Select doesn't give mouse event universally)
                // Fallback to center screen or just URL param as before? 
                // Creating new task -> maybe still open sidebar or model? 
                // User specifically asked for "clicking on a task". 
                // Let's stick to sidebar for NEW tasks for now to avoid complexity of positioning not from a click.
                setSearchParams({ task: newTask.id })
            }
        })
    }

    const handleEventClick = (info: any) => {
        info.jsEvent.preventDefault()
        const x = info.jsEvent.clientX
        const y = info.jsEvent.clientY

        // Basic screen edge detection to prevent overflow
        const winW = window.innerWidth
        const winH = window.innerHeight
        const popupW = 400
        const popupH = 500

        let safeX = x + 10
        let safeY = y - 50

        if (safeX + popupW > winW) safeX = x - popupW - 10
        if (safeY + popupH > winH) safeY = winH - popupH - 20
        if (safeY < 0) safeY = 20

        setPopup({ taskId: info.event.id, x: safeX, y: safeY })
    }

    // ... handleEventDrop, handleEventResize same as before ...

    const handleEventDrop = (info: EventDropArg) => {
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


    return (
        <div className="h-full flex flex-col bg-white overflow-hidden relative">
            {/* Toolbar */}
            <div className="flex items-center justify-end px-3 py-2 border-b border-gray-100 z-10 shrink-0">
                <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className={clsx(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        showCompleted
                            ? "bg-blue-50 text-blue-700 border border-blue-100"
                            : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"
                    )}
                >
                    {showCompleted ? (
                        <>
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            Hide Completed
                        </>
                    ) : (
                        <>
                            <span className="w-2 h-2 rounded-full bg-gray-300" />
                            Show Completed
                        </>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative daily-planner-wrapper">
                <FullCalendar
                    plugins={[timeGridPlugin, interactionPlugin]}
                    initialView="timeGridDay"
                    headerToolbar={false}
                    allDaySlot={true}
                    slotDuration="00:30:00"
                    slotLabelInterval="01:00"
                    editable={true}
                    selectable={true}
                    selectMirror={true}
                    select={handleDateSelect}
                    eventClick={handleEventClick}
                    height="100%"
                    events={events}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    allDayText="All Day"
                    nowIndicator={true}
                    slotMinTime={hideNightTime ? "07:00:00" : "00:00:00"}
                    slotMaxTime={hideNightTime ? "23:00:00" : "24:00:00"}
                    scrollTime="08:00:00"
                    eventClassNames="text-xs font-medium rounded-md px-1 shadow-sm border-0"
                />
            </div>

            {/* Task Popover */}
            {popup && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40 bg-transparent" // Transparent to allow seeing context, but capturing click
                        onClick={() => setPopup(null)}
                    />
                    {/* Popover Card */}
                    <div
                        className="fixed z-50 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                        style={{
                            left: popup.x,
                            top: popup.y,
                            width: 380,
                            height: 520,
                        }}
                    >
                        <TaskDetail taskId={popup.taskId} />
                        {/* Close Button Overlay */}
                        <button
                            onClick={() => setPopup(null)}
                            className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors z-20"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
