import { useMemo } from 'react'
import type { TaskWithTags } from '@/hooks/useTasks'
import type { SortOption, GroupOption } from './ViewOptions'
import type { Project } from '@/types/database'

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
    projects?: Project[]
}

export function useTaskView({ tasks, showCompleted, sortBy, groupBy, projects }: UseTaskViewProps) {
    const sortedAndGroupedTasks = useMemo(() => {
        if (!tasks) return {}

        // 1. Filter
        let filtered = showCompleted ? tasks : tasks.filter(t => !t.is_completed)

        // 2. Sort (Applied before grouping to ensure group order or item order within groups)
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
                    if (b.due_date === null) return -1
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

        if (groupBy === 'date') {
            const dateGroups: Record<string, TaskWithTags[]> = {
                'DEADLINE': [],
                'CALENDAR': [],
                'ALL DAY': []
            }

            filtered.forEach(task => {
                // 1. DEADLINE: Project tasks (multi-step) with a due date
                // We use is_project logic as requested
                if (task.is_project && task.due_date) {
                    dateGroups['DEADLINE'].push(task)
                    return
                }

                // 2. CALENDAR: Tasks with specific start/end times
                // Assuming start_time is populated for calendar events. 
                // Also check if it's explicitly set to be a calendar item if you have such a flag, but start_time is the standard indicator.
                if (task.start_time || task.end_time) {
                    dateGroups['CALENDAR'].push(task)
                    return
                }

                // 3. ALL DAY: Everything else
                dateGroups['ALL DAY'].push(task)
            })

            // Filter out empty groups and return in specific order
            const orderedGroups: Record<string, TaskWithTags[]> = {}
            if (dateGroups['DEADLINE'].length > 0) orderedGroups['DEADLINE'] = dateGroups['DEADLINE']
            if (dateGroups['CALENDAR'].length > 0) orderedGroups['CALENDAR'] = dateGroups['CALENDAR']
            if (dateGroups['ALL DAY'].length > 0) orderedGroups['ALL DAY'] = dateGroups['ALL DAY']

            return orderedGroups
        } else if (groupBy === 'priority') {
            filtered.forEach(task => {
                const p = task.priority || 'none'
                // Capitalize for display
                const groupName = p.charAt(0).toUpperCase() + p.slice(1)
                if (!groups[groupName]) groups[groupName] = []
                groups[groupName].push(task)
            })

            const orderedGroups: Record<string, TaskWithTags[]> = {}
            const keys = ['High', 'Medium', 'Low', 'None']
            keys.forEach(k => {
                if (groups[k] && groups[k].length > 0) orderedGroups[k] = groups[k]
            })
            return orderedGroups
        } else if (groupBy === 'project') {
            filtered.forEach(task => {
                let groupName = 'Inbox'
                if (task.project_id) {
                    const proj = projects?.find(p => p.id === task.project_id)
                    if (proj) groupName = proj.name
                    else groupName = 'Unknown Project'
                }

                if (!groups[groupName]) groups[groupName] = []
                groups[groupName].push(task)
            })

            // Default sort: Inbox first, then A-Z
            const orderedGroups: Record<string, TaskWithTags[]> = {}
            if (groups['Inbox']) orderedGroups['Inbox'] = groups['Inbox']
            const otherKeys = Object.keys(groups).filter(k => k !== 'Inbox').sort()
            otherKeys.forEach(k => orderedGroups[k] = groups[k])

            return orderedGroups
        } else if (groupBy === 'tag') {
            filtered.forEach(task => {
                if (!task.tags || task.tags.length === 0) {
                    if (!groups['No Tags']) groups['No Tags'] = []
                    groups['No Tags'].push(task)
                } else {
                    task.tags.forEach(tag => {
                        if (!groups[tag.name]) groups[tag.name] = []
                        groups[tag.name].push(task)
                    })
                }
            })

            const orderedGroups: Record<string, TaskWithTags[]> = {}
            const keys = Object.keys(groups).filter(k => k !== 'No Tags').sort()
            keys.forEach(k => orderedGroups[k] = groups[k])
            if (groups['No Tags']) orderedGroups['No Tags'] = groups['No Tags']
            return orderedGroups
        }

        return groups
    }, [tasks, showCompleted, sortBy, groupBy, projects])

    return sortedAndGroupedTasks
}
