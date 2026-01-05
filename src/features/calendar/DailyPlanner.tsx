import { } from 'react'
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

        return {
            id: task.id,
            title: task.title,
            start: start || undefined,
            end: end || undefined,
            allDay: !task.start_time, // Simple heuristic for now: no start_time = all day
            backgroundColor: task.is_completed ? '#e5e7eb' : '#3b82f6',
            borderColor: task.is_completed ? '#d1d5db' : '#2563eb',
            textColor: task.is_completed ? '#9ca3af' : '#ffffff',
        }
    }) || []

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
                setSearchParams({ task: newTask.id })
            }
        })
    }

    const handleEventClick = (info: any) => {
        setSearchParams({ task: info.event.id })
    }

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

            // Fix: ensure due_date is YYYY-MM-DD
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
                    due_date: dateStr // Fixed
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
                    scrollTime="08:00:00"
                    eventClassNames="text-xs font-medium rounded-md px-1"
                />
            </div>
        </div>
    )
}
