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

export function CalendarPage() {
    const { data: tasks, isLoading } = useAllTasks()
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createTask } = useCreateTask()
    const [_, setSearchParams] = useSearchParams()

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
            // All-day: use local date string
            const d = selectInfo.start
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            updates.due_date = `${year}-${month}-${day}`
        } else {
            // Timed: use ISO strings
            updates.start_time = selectInfo.startStr
            updates.end_time = selectInfo.endStr
            updates.due_date = selectInfo.startStr.split('T')[0]
        }

        createTask(updates, {
            onSuccess: (newTask) => {
                // Automatically open the detail modal for the new task
                setSearchParams({ task: newTask.id })
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

    const events = tasks?.map(task => {
        let start = task.start_time || task.due_date
        let end = task.end_time

        return {
            id: task.id,
            title: task.title,
            start: start || undefined,
            end: end || undefined,
            allDay: !task.start_time,
            // Logic for color could be improved if project data was joined or available
            backgroundColor: task.is_completed ? '#e5e7eb' : '#3b82f6',
            borderColor: task.is_completed ? '#d1d5db' : '#2563eb',
            textColor: task.is_completed ? '#9ca3af' : '#ffffff',
            extendedProps: {
                projectId: task.project_id,
                description: task.description,
                isCompleted: task.is_completed
            }
        }
    }) || []

    const handleEventDrop = (info: any) => {
        const taskId = info.event.id
        const isAllDay = info.event.allDay

        if (isAllDay && info.event.start) {
            // FORCE local YYYY-MM-DD to avoid UTC shift for all-day events
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
            // Dropped into TimeGrid or DayGrid (as timed event)
            const newStart = info.event.start?.toISOString() || null
            const newEnd = info.event.end?.toISOString() || null

            updateTask({
                taskId,
                updates: {
                    start_time: newStart,
                    end_time: newEnd,
                    due_date: newStart // Sync due_date with start time
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

    const handleEventClick = (info: any) => {
        setSearchParams({ task: info.event.id })
    }

    return (
        <div className="h-full flex flex-col bg-white p-4">
            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, multiMonthPlugin]}
                headerToolbar={{
                    left: 'timeGridDay,timeGridWeek,dayGridMonth,multiMonthYear',
                    center: 'title',
                    right: 'prev,today,next'
                }}
                initialView="timeGridWeek"
                firstDay={1}
                editable={true}
                selectable={true}
                selectMirror={true}
                select={handleDateSelect}
                dayMaxEvents={true}
                height="100%"
                events={events}
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
