import { useMemo } from 'react'
import { isToday, isTomorrow, isBefore, startOfToday, format, parseISO } from 'date-fns'
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
            // Case 1: Single Day View (e.g. Today/Tomorrow pages)
            if (targetDate) {
                const dateGroups: Record<string, TaskWithTags[]> = {
                    'DEADLINE': [],
                    'CALENDAR': [],
                    'ALL DAY': []
                }

                // 1. Strict Filter: Only allow tasks implicitly scheduled for TARGET DATE.
                const targetTasks = filtered.filter(task => {
                    const hasDate = task.due_date && task.due_date.startsWith(targetDate)
                    const hasTime = task.start_time && task.start_time.startsWith(targetDate)
                    return hasDate || hasTime
                })

                const tasksMap = new Map(targetTasks.map(t => [t.id, t]))

                // 2. Partition
                targetTasks.forEach(task => {
                    if (task.is_project) {
                        dateGroups['DEADLINE'].push(task)
                        return
                    }
                    if (task.start_time) {
                        dateGroups['CALENDAR'].push(task)
                        return
                    }
                    dateGroups['ALL DAY'].push(task)
                })

                // Sort CALENDAR roots by time
                dateGroups['CALENDAR'].sort((a, b) => {
                    const timeA = a.start_time || a.end_time || ''
                    const timeB = b.start_time || b.end_time || ''
                    return timeA.localeCompare(timeB)
                })

                const overdueTasks = filtered.filter(task => {
                    if (task.is_completed) return false
                    return task.due_date && task.due_date < targetDate
                })

                const orderedGroups: Record<string, TaskWithTags[]> = {}

                if (overdueTasks.length > 0) {
                    orderedGroups['Просрочено'] = organizeByHierarchy(overdueTasks)
                }

                if (dateGroups['DEADLINE'].length > 0) orderedGroups['DEADLINE'] = organizeByHierarchy(dateGroups['DEADLINE'], tasksMap)
                if (dateGroups['CALENDAR'].length > 0) orderedGroups['CALENDAR'] = organizeByHierarchy(dateGroups['CALENDAR'], tasksMap)
                if (dateGroups['ALL DAY'].length > 0) orderedGroups['ALL DAY'] = organizeByHierarchy(dateGroups['ALL DAY'], tasksMap)

                return orderedGroups
            }

            // Case 2: General View (e.g. Project/Inbox grouped by Date)
            const groups: Record<string, TaskWithTags[]> = {}
            const today = startOfToday()

            // Helper to get group key and sort value
            const getGroupInfo = (task: TaskWithTags) => {
                if (!task.due_date) return { key: 'No Date', sort: 9999999999999 } // End of list

                const date = parseISO(task.due_date)

                if (isBefore(date, today)) return { key: 'Overdue', sort: -1 }
                if (isToday(date)) return { key: 'Today', sort: 0 }
                if (isTomorrow(date)) return { key: 'Tomorrow', sort: 1 }

                // Future dates
                return {
                    key: format(date, 'd MMM • EEEE'),
                    sort: date.getTime()
                }
            }

            filtered.forEach(task => {
                const { key } = getGroupInfo(task)
                if (!groups[key]) groups[key] = []
                groups[key].push(task)
            })

            // Sort groups
            const orderedGroups: Record<string, TaskWithTags[]> = {}

            // Get all unique keys and sort them using a sample task or re-deriving sort val
            // Easier: just sort the keys based on our known logic
            const sortedKeys = Object.keys(groups).sort((a, b) => {
                const getSortVal = (k: string) => {
                    if (k === 'No Date') return 9999999999999
                    if (k === 'Overdue') return -1
                    if (k === 'Today') return 0
                    if (k === 'Tomorrow') return 1
                    // Parse formatted date back? Tricky.
                    // Better: Find a representative task for this group and use its date
                    const task = groups[k][0]
                    if (task && task.due_date) return parseISO(task.due_date).getTime()
                    return 999
                }
                return getSortVal(a) - getSortVal(b)
            })

            sortedKeys.forEach(key => {
                orderedGroups[key] = organizeByHierarchy(groups[key]) // Use simple hierarchy
            })

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
        } else if (groupBy.startsWith('tag')) {
            const categoryFilter = groupBy === 'tag' ? null : groupBy.replace('tag-', '')

            filtered.forEach(task => {
                let taskTags = task.tags || []

                // Filter tags based on selected category
                if (categoryFilter) {
                    if (categoryFilter === 'other') {
                        // Tags that have NO category or category not in known list
                        const knownCategories = ['place', 'energy', 'time', 'people']
                        taskTags = taskTags.filter(t => !t.category || !knownCategories.includes(t.category))
                    } else {
                        taskTags = taskTags.filter(t => t.category === categoryFilter)
                    }
                }

                if (taskTags.length === 0) {
                    // Task has no tags (or no tags in this category)
                    const noTagLabel = categoryFilter ? 'No Matching Tag' : 'No Tags'
                    if (!groups[noTagLabel]) groups[noTagLabel] = []
                    groups[noTagLabel].push(task)
                } else {
                    taskTags.forEach(tag => {
                        if (!groups[tag.name]) groups[tag.name] = []
                        groups[tag.name].push(task)
                    })
                }
            })

            const orderedGroups: Record<string, TaskWithTags[]> = {}
            const keys = Object.keys(groups).sort()

            // Prioritize real tags, put "No ..." last
            keys.filter(k => k !== 'No Tags' && k !== 'No Matching Tag').forEach(k => {
                orderedGroups[k] = organizeByHierarchy(groups[k])
            })

            if (groups['No Matching Tag']) orderedGroups['No Matching Tag'] = organizeByHierarchy(groups['No Matching Tag'])
            if (groups['No Tags']) orderedGroups['No Tags'] = organizeByHierarchy(groups['No Tags'])

            return orderedGroups
        } else if (groupBy === 'complexity') {
            const visibleIds = new Set(filtered.map(t => t.id))
            const visibleParentIds = new Set(filtered.map(t => t.parent_id).filter(Boolean))

            filtered.forEach(task => {
                const isProject = task.is_project
                const isParent = visibleParentIds.has(task.id)
                // A task is a child in this context if it has a parent AND that parent is also in the current view
                // If parent is missing, we treat it as an independent root (Single Action) unless it is a project itself
                const hasVisibleParent = task.parent_id && visibleIds.has(task.parent_id)

                // Complex if: It's a Project OR It's a Parent OR It belongs to a Parent
                const isComplex = isProject || isParent || hasVisibleParent

                const key = isComplex ? 'Multi-step Tasks' : 'Single Actions'

                if (!groups[key]) groups[key] = []
                groups[key].push(task)
            })

            const orderedGroups: Record<string, TaskWithTags[]> = {}
            if (groups['Multi-step Tasks']) orderedGroups['Multi-step Tasks'] = organizeByHierarchy(groups['Multi-step Tasks'])
            if (groups['Single Actions']) orderedGroups['Single Actions'] = organizeByHierarchy(groups['Single Actions'])

            return orderedGroups
        }

        return groups
    }, [tasks, showCompleted, sortBy, groupBy, projects])

    return sortedAndGroupedTasks
}
