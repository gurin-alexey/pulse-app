import clsx from 'clsx'
import { format } from 'date-fns'
import { generateRecurringInstances } from '@/utils/recurrence'

type BuildCalendarEventsParams = {
    tasks: any[] | undefined
    occurrencesMap: any
    rangeStart: Date
    rangeEnd: Date
    showCompleted: boolean
}

const getDateStr = (value: string | null | undefined) => {
    if (!value) return null
    return value.split('T')[0]
}

export const mapTaskToEvent = (task: any, allTasks?: any[]) => {
    const start = task.start_time || task.due_date
    const end = task.end_time

    const originalTaskId = task.original_id || task.id
    const originalTask = allTasks?.find(t => t.id === originalTaskId) || task
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
    const priorityRank = task.priority === 'high' ? 0 : task.priority === 'medium' ? 1 : task.priority === 'low' ? 2 : 3

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
        priorityRank,
        isCompleted: task.is_completed,
        extendedProps: {
            projectId: task.project_id,
            description: task.description,
            isCompleted: task.is_completed,
            originalId: task.original_id || task.id,
            isVirtual: task.is_virtual || false,
            occurrenceDate: task.occurrence_date || occurrenceDateStr || null,
            priority: task.priority,
            priorityRank,
            recurrenceRule: task.recurrence_rule || null,
            isMaster
        }
    }
}

export const buildCalendarEvents = ({
    tasks,
    occurrencesMap,
    rangeStart,
    rangeEnd,
    showCompleted
}: BuildCalendarEventsParams) => {
    if (!tasks) return []

    const allEvents: any[] = []
    const rangeStartStr = format(rangeStart, 'yyyy-MM-dd')
    const rangeEndStr = format(rangeEnd, 'yyyy-MM-dd')

    tasks.forEach(task => {
        if (!showCompleted && task.is_completed) return

        if (task.recurrence_rule) {
            // 1) Render the master task itself.
            allEvents.push(mapTaskToEvent(task, tasks))

            // 2) Render following occurrences, skipping the master date to avoid duplicates.
            const masterDateStr = (task.start_time || task.due_date || '').split('T')[0]
            const isMasterInRange = !!masterDateStr && masterDateStr >= rangeStartStr && masterDateStr <= rangeEndStr

            const instances = generateRecurringInstances(task, rangeStart, rangeEnd, occurrencesMap)
            let filtered = instances.filter(instance => {
                if (!showCompleted && instance.is_completed) return false
                if (isMasterInRange && instance.occurrence_date === masterDateStr) return false
                return true
            })

            // Fallback: if the master date is in range but no instance matched it,
            // drop the first occurrence to avoid a phantom duplicate day.
            if (isMasterInRange && filtered.length === instances.length && filtered.length > 0) {
                filtered = filtered.slice(1)
            }

            filtered.forEach(instance => {
                allEvents.push(mapTaskToEvent(instance, tasks))
            })
        } else {
            allEvents.push(mapTaskToEvent(task, tasks))
        }
    })

    allEvents.sort((a, b) => Number(a.extendedProps.isCompleted) - Number(b.extendedProps.isCompleted))
    return allEvents
}

export const renderCalendarEventContent = (eventInfo: any) => {
    const { timeText, event } = eventInfo
    const isCompleted = event.extendedProps.isCompleted

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
