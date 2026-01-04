import { useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useAllTasks } from '@/hooks/useAllTasks'
import { Loader2 } from 'lucide-react'
import { useUpdateTask } from '@/hooks/useUpdateTask'

// Manually define the type if it's missing or named differently in this version
interface EventDropArg {
    event: any
    // ... other props if needed
}
import './calendar.css' // We'll create this for custom styling if needed

export function DailyPlanner() {
    const { data: tasks, isLoading } = useAllTasks()
    const { mutate: updateTask } = useUpdateTask()

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <Loader2 className="animate-spin mr-2" />
                Loading schedule...
            </div>
        )
    }

    const events = tasks?.map(task => {
        // Fallback logic: if start_time is missing, try due_date
        let start = task.start_time || task.due_date
        let end = task.end_time

        // Treat as All Day if explicitly stored as date-only OR if missing explicit time
        const isAllDay = (!task.start_time && !!task.due_date && task.due_date.length <= 10)
            || (task.start_time ? false : true) && !!task.due_date

        // Better logic: if start_time exists, it's NOT all day unless explicitly set (but we don't have is_all_day column yet)
        // So we assume if start_time is present, it's a timed event. 
        // If only due_date is present (and it's YYYY-MM-DD), it's all day.

        return {
            id: task.id,
            title: task.title,
            start: start || undefined,
            end: end || undefined,
            allDay: !task.start_time, // Simple heuristic for now: no start_time = all day
            backgroundColor: task.status === 'done' ? '#e5e7eb' : '#3b82f6',
            borderColor: task.status === 'done' ? '#d1d5db' : '#2563eb',
            textColor: task.status === 'done' ? '#9ca3af' : '#ffffff',
        }
    }) || []

    const handleEventDrop = (info: EventDropArg) => {
        const taskId = info.event.id
        const isAllDay = info.event.allDay

        if (isAllDay && info.event.start) {
            // FORCE local YYYY-MM-DD to avoid UTC shift
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
            // Dropped into TimeGrid
            const newStart = info.event.start?.toISOString() || null
            const newEnd = info.event.end?.toISOString() || null

            updateTask({
                taskId,
                updates: {
                    start_time: newStart,
                    end_time: newEnd,
                    due_date: newStart // Keep sync
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
        <div className="h-full flex flex-col bg-white">
            <div className="flex-1 overflow-hidden relative daily-planner-wrapper">
                <FullCalendar
                    plugins={[timeGridPlugin, interactionPlugin]}
                    initialView="timeGridDay"
                    headerToolbar={false}
                    allDaySlot={true}
                    slotDuration="00:30:00"
                    slotLabelInterval="01:00"
                    editable={true}
                    height="100%"
                    events={events}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    allDayText="All Day"
                    nowIndicator={true}
                    scrollTime="08:00:00"
                    eventClassNames="text-xs font-medium rounded-md px-1"
                />
            </div>
        </div>
    )
}
