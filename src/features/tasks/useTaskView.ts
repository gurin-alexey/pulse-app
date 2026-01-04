import { useMemo } from 'react'
import type { TaskWithTags } from '@/hooks/useTasks'
import type { SortOption, GroupOption } from './ViewOptions'

// Helper to normalized date (set time to 00:00:00)
const startOfDay = (d: Date) => {
    const copy = new Date(d)
    copy.setHours(0, 0, 0, 0)
    return copy
}

type UseTaskViewProps = {
    tasks: TaskWithTags[] | undefined
    showCompleted: boolean
    sortBy: SortOption
    groupBy: GroupOption
}

export function useTaskView({ tasks, showCompleted, sortBy, groupBy }: UseTaskViewProps) {
    const sortedAndGroupedTasks = useMemo(() => {
        if (!tasks) return {}

        // 1. Filter
        let filtered = showCompleted ? tasks : tasks.filter(t => !t.is_completed)

        // 2. Sort (Applied before grouping to ensure group order or item order within groups)
        // Note: If grouping by date, we might want to force sorting by date within groups?
        // Let's adhere to the selected sort.
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'date_created':
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                case 'alphabetical':
                    return a.title.localeCompare(b.title)
                case 'due_date':
                    // Tasks with due_date come first, nulls last
                    if (!a.due_date && !b.due_date) return 0
                    if (!a.due_date) return 1
                    if (b.due_date === null) return -1 // Fix typescript warning logic
                    if (!b.due_date) return -1
                    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                default:
                    return 0
            }
        })

        // 3. Group
        if (groupBy === 'none') {
            return { 'All Tasks': filtered }
        }

        const groups: Record<string, TaskWithTags[]> = {}

        if (groupBy === 'status') {
            groups['To Do'] = filtered.filter(t => !t.is_completed)
            groups['Completed'] = filtered.filter(t => t.is_completed)
            // Remove empty groups? Maybe keep 'To Do' always.
        } else if (groupBy === 'date') {
            const today = startOfDay(new Date())
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)

            filtered.forEach(task => {
                let groupName = 'No Date'
                if (task.due_date) {
                    const due = startOfDay(new Date(task.due_date))
                    if (due < today) groupName = 'Overdue'
                    else if (due.getTime() === today.getTime()) groupName = 'Today'
                    else if (due.getTime() === tomorrow.getTime()) groupName = 'Tomorrow'
                    else groupName = 'Later'
                }

                if (!groups[groupName]) groups[groupName] = []
                groups[groupName].push(task)
            })

            // Ensure specific order of keys
            const orderedGroups: Record<string, TaskWithTags[]> = {}
            const keys = ['Overdue', 'Today', 'Tomorrow', 'Later', 'No Date']
            keys.forEach(k => {
                if (groups[k] && groups[k].length > 0) orderedGroups[k] = groups[k]
            })
            return orderedGroups
        }

        return groups
    }, [tasks, showCompleted, sortBy, groupBy])

    return sortedAndGroupedTasks
}
