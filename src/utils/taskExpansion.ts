import { generateRecurringInstances } from '@/utils/recurrence'

export type TaskExpansionMode = 'today' | 'tomorrow'

export const expandTasksForDate = (
    tasks: any[] | undefined,
    targetDate: string | null | undefined,
    occurrencesMap: Record<string, string> | Map<string, string> | undefined,
    mode: TaskExpansionMode
) => {
    if (!tasks || !targetDate) return { active: [], completed: [] }

    const active: any[] = []
    const completed: any[] = []

    for (const task of tasks) {
        if (task.recurrence_rule) {
            try {
                // For "today" mode, include overdue recurring instances
                let start: Date
                if (mode === 'today') {
                    start = new Date(targetDate + 'T00:00:00')
                    start.setMonth(start.getMonth() - 3)
                } else {
                    start = new Date(targetDate + 'T00:00:00')
                }
                start.setMinutes(start.getMinutes() - 15) // small buffer

                const end = new Date(targetDate + 'T23:59:59')
                end.setMinutes(end.getMinutes() + 15)

                const instances = generateRecurringInstances(task, start, end, occurrencesMap)

                const filtered = instances.filter(instance => {
                    const instanceDate = instance.due_date?.split('T')[0]
                    if (instanceDate === targetDate) return true
                    if (mode === 'today' && instanceDate && instanceDate < targetDate) {
                        return true // overdue
                    }
                    return false
                })

                if (filtered.length > 0) {
                    filtered.forEach(instance => {
                        if (instance.is_completed) {
                            completed.push(instance)
                        } else {
                            active.push(instance)
                        }
                    })
                }
            } catch (e) {
                console.error('Error expanding task recurrence', task.id, e)
            }
        } else {
            const d = task.due_date?.split('T')[0]
            const isMatch = d === targetDate
            const isOverdue = mode === 'today' && d && targetDate && d < targetDate

            if (isMatch || isOverdue) {
                if (task.is_completed) {
                    completed.push(task)
                } else {
                    active.push(task)
                }
            }
        }
    }

    return { active, completed }
}
