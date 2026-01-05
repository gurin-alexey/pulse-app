import { RRule, rrulestr } from 'rrule'
import type { Task } from '@/types/database'
import { startOfDay } from 'date-fns'

export const generateRecurringInstances = (task: Task, rangeStart: Date, rangeEnd: Date) => {
    if (!task.recurrence_rule || !task.due_date) {
        return [task]
    }

    try {
        // Base Date: Use start_time if available (for correct time), otherwise due_date (start of day)
        const dtstart = task.start_time ? new Date(task.start_time) : new Date(task.due_date + 'T00:00:00')

        // Parse the rule string
        const options = RRule.parseString(task.recurrence_rule)

        // Create RRule instance with dtstart
        const rule = new RRule({
            ...options,
            dtstart: dtstart,
        })

        // Get dates within range (including some buffer to handle edge cases)
        const dates = rule.between(rangeStart, rangeEnd, true)

        // Map dates to virtual task instances
        return dates.map((date, index) => {
            // Calculate end time duration if exists
            let endTimeString = null
            if (task.start_time && task.end_time) {
                const start = new Date(task.start_time)
                const end = new Date(task.end_time)
                const duration = end.getTime() - start.getTime()
                const newEnd = new Date(date.getTime() + duration)
                endTimeString = newEnd.toISOString()
            }

            // For ISO date string (YYYY-MM-DD), we need local time, but toISOString is UTC.
            // Adjust for local display if needed, or just standard formatting
            // Simplest is to format manually or use libraries.
            // However, our task.due_date is text YYYY-MM-DD.
            // format(date, 'yyyy-MM-dd') from date-fns is good.

            // Wait, we need to create a copy of the task
            // The ID should probably be unique for keys, e.g., originalId_date

            const instanceDueStr = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, '0'),
                String(date.getDate()).padStart(2, '0')
            ].join('-')

            return {
                ...task,
                id: `${task.id}_recur_${date.getTime()}`, // Virtual ID
                original_id: task.id, // Reference to master
                due_date: instanceDueStr,
                start_time: task.start_time ? date.toISOString() : null,
                end_time: endTimeString,
                is_virtual: true // Marker
            }
        })

    } catch (e) {
        console.error('Failed to parse recurrence rule for task', task.id, e)
        return [task] // Fallback to single instance
    }
}
