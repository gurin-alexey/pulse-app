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
    targetDate?: string
}

// Helper to organize tasks hierarchically within a group
const organizeByHierarchy = (roots: TaskWithTags[], allTasksMap?: Map<string, TaskWithTags>) => {
    // If no global map provided, build one from the roots list (legacy behavior for other views)
    const sourceMap = allTasksMap || new Map(roots.map(t => [t.id, t]))

    // If using legacy behavior (no global map), we need to find roots within the provided list
    // If global map provided, 'roots' are already assumed to be the top-level items for this group
    const actualRoots = allTasksMap ? roots : roots.filter(t => !t.parent_id || !sourceMap.has(t.parent_id))

    const result: any[] = []

    // We need to look up children from the source of truth
    // If allTasksMap is passed, we search ALL filtered tasks for children
    // If not, we only search within the group
    const potentialChildren = allTasksMap ? Array.from(allTasksMap.values()) : roots

    const addChildren = (parentId: string, depth: number) => {
        const children = potentialChildren.filter(t => t.parent_id === parentId)
        // Sort children by sort_order or created_at to ensure consistent order
        children.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

        children.forEach(child => {
            result.push({ ...child, depth })
            addChildren(child.id, depth + 1)
        })
    }

    actualRoots.forEach(root => {
        result.push({ ...root, depth: 0 })
        addChildren(root.id, 1)
    })

    return result
}

export function useTaskView({ tasks, showCompleted, sortBy, groupBy, projects, targetDate }: UseTaskViewProps) {
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

            // Determine target date string (default to Today if not provided)
            let targetStr = targetDate
            if (!targetStr) {
                const date = new Date()
                targetStr = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
            }

            // 1. Strict Filter: Only allow tasks implicitly scheduled for TARGET DATE.
            // Tasks without a date (even if subtasks of projects) are EXCLUDED.
            const targetTasks = filtered.filter(task => {
                const hasDate = task.due_date && task.due_date.startsWith(targetStr)
                const hasTime = task.start_time && task.start_time.startsWith(targetStr)
                return hasDate || hasTime
            })

            const tasksMap = new Map(targetTasks.map(t => [t.id, t]))

            // 3. Partition
            targetTasks.forEach(task => {
                // 1. DEADLINE: Projects (Multi-step)
                if (task.is_project) {
                    dateGroups['DEADLINE'].push(task)
                    return
                }

                // 2. CALENDAR: Tasks with Time
                if (task.start_time) {
                    dateGroups['CALENDAR'].push(task)
                    return
                }

                // 3. ALL DAY: Everything else (Tasks with Date but No Time)
                dateGroups['ALL DAY'].push(task)
            })

            // Sort CALENDAR roots by time
            dateGroups['CALENDAR'].sort((a, b) => {
                const timeA = a.start_time || a.end_time || ''
                const timeB = b.start_time || b.end_time || ''
                return timeA.localeCompare(timeB)
            })

            // Expand hierarchies
            // Since tasksMap IS strict, generic children (no date) are naturally excluded from the hierarchy.
            const orderedGroups: Record<string, TaskWithTags[]> = {}
            if (dateGroups['DEADLINE'].length > 0) orderedGroups['DEADLINE'] = organizeByHierarchy(dateGroups['DEADLINE'], tasksMap)
            if (dateGroups['CALENDAR'].length > 0) orderedGroups['CALENDAR'] = organizeByHierarchy(dateGroups['CALENDAR'], tasksMap)
            if (dateGroups['ALL DAY'].length > 0) orderedGroups['ALL DAY'] = organizeByHierarchy(dateGroups['ALL DAY'], tasksMap)

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
                if (groups[k] && groups[k].length > 0) orderedGroups[k] = organizeByHierarchy(groups[k])
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
            if (groups['Inbox']) orderedGroups['Inbox'] = organizeByHierarchy(groups['Inbox'])
            const otherKeys = Object.keys(groups).filter(k => k !== 'Inbox').sort()
            otherKeys.forEach(k => orderedGroups[k] = organizeByHierarchy(groups[k]))

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
            keys.forEach(k => orderedGroups[k] = organizeByHierarchy(groups[k]))
            if (groups['No Tags']) orderedGroups['No Tags'] = organizeByHierarchy(groups['No Tags'])
            return orderedGroups
        }

        return groups
    }, [tasks, showCompleted, sortBy, groupBy, projects])

    return sortedAndGroupedTasks
}
