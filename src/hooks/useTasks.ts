import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, Tag } from '@/types/database'

export type TaskWithTags = Task & {
    tags: Tag[]
    subtasks_count?: number
}

export type TaskFilter =
    | { type: 'inbox', includeSubtasks?: boolean }
    | { type: 'today', includeSubtasks?: boolean }
    | { type: 'tomorrow', includeSubtasks?: boolean }
    | { type: 'project', projectId: string, includeSubtasks?: boolean }
    | { type: 'trash', includeSubtasks?: boolean }
    | { type: 'all', includeSubtasks?: boolean }
    | { type: 'is_project' }
    | { type: 'completed', period: 'today' | 'yesterday' | 'week' | 'month' | 'all', tags?: string[], projectId?: string, priority?: string }

export async function fetchTasks(filter: TaskFilter) {
    let query = supabase
        .from('tasks')
        .select('*, task_tags(tags(*))')

    if (filter.type === 'is_project') {
        query = supabase
            .from('tasks')
            .select('*, task_tags(tags(*)), subtasks:tasks!parent_id(count)')
    }

    if (filter.type === 'trash') {
        query = query.order('deleted_at', { ascending: false })
    } else if (filter.type === 'completed') {
        query = query.order('completed_at', { ascending: false })
    } else {
        query = query.order('created_at', { ascending: false })
    }

    // Filter parent_id unless includeSubtasks is true
    // @ts-ignore
    if (!filter.includeSubtasks) {
        query = query.is('parent_id', null)
    }

    if (filter.type === 'trash') {
        query = query.not('deleted_at', 'is', null)
    } else {
        query = query.is('deleted_at', null)
    }

    if (filter.type === 'project') {
        query = query.eq('project_id', filter.projectId)
    } else if (filter.type === 'inbox') {
        query = query.is('project_id', null)
    } else if (filter.type === 'today' || filter.type === 'tomorrow') {
        // Calculate date
        const date = new Date()
        // Adjust to local time representation
        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))

        if (filter.type === 'tomorrow') {
            localDate.setDate(localDate.getDate() + 1)
        }

        const targetDateStr = localDate.toISOString().split('T')[0]

        // Fetch tasks that are due within the target date range OR are recurring
        // Using range (gte/lte) ensures we catch tasks with time components in due_date
        // syntax: or(and(due_date.gte.START,due_date.lte.END),recurrence_rule.not.is.null)
        // Note: Supabase JS client .or() accepts raw PostgREST string
        const start = `${targetDateStr}T00:00:00`
        const end = `${targetDateStr}T23:59:59`

        if (filter.type === 'today') {
            query = query.or(`and(due_date.lt.${start},is_completed.eq.false),and(due_date.gte.${start},due_date.lte.${end}),recurrence_rule.not.is.null`)
        } else {
            query = query.or(`and(due_date.gte.${start},due_date.lte.${end}),recurrence_rule.not.is.null`)
        }
    } else if (filter.type === 'is_project') {
        query = query
            .eq('is_project', true)
            .not('due_date', 'is', null)
    } else if (filter.type === 'completed') {
        query = query.is('is_completed', true)

        // Period Filtering
        if (filter.period !== 'all') {
            const now = new Date()
            const today = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
            today.setHours(0, 0, 0, 0)

            if (filter.period === 'today') {
                const tomorrow = new Date(today)
                tomorrow.setDate(tomorrow.getDate() + 1)
                query = query.gte('completed_at', today.toISOString()).lt('completed_at', tomorrow.toISOString())
            } else if (filter.period === 'yesterday') {
                const yesterday = new Date(today)
                yesterday.setDate(yesterday.getDate() - 1)
                query = query.gte('completed_at', yesterday.toISOString()).lt('completed_at', today.toISOString())
            } else if (filter.period === 'week') {
                const weekAgo = new Date(today)
                weekAgo.setDate(weekAgo.getDate() - 7)
                query = query.gte('completed_at', weekAgo.toISOString())
            } else if (filter.period === 'month') {
                const monthAgo = new Date(today)
                monthAgo.setDate(monthAgo.getDate() - 30)
                query = query.gte('completed_at', monthAgo.toISOString())
            }
        }

        // Additional Filters
        if (filter.projectId) {
            query = query.eq('project_id', filter.projectId)
        }
        if (filter.priority) {
            query = query.eq('priority', filter.priority)
        }
        // Tags filtering is tricky with Supabase basic query builder on related tables for "AND" logic
        // We will likely filter post-fetch for tags to be safe, or use custom RPC if performance needed.
        // For now, let's filter after fetch for simplicity as list won't be massive typically.
    }

    const { data: initialData, error } = await query

    if (error) throw error

    let finalData = initialData as any[]

    // Special handling for 'today'/'tomorrow' view: Fetch subtasks of the found tasks
    if ((filter.type === 'today' || filter.type === 'tomorrow') && filter.includeSubtasks && finalData.length > 0) {
        const parentIds = finalData.map(t => t.id)

        // Fetch children
        const { data: children, error: childError } = await supabase
            .from('tasks')
            .select('*, task_tags(tags(*))')
            .in('parent_id', parentIds)
            .is('deleted_at', null)

        if (childError) throw childError

        if (children && children.length > 0) {
            // Deduplicate: Only add children that aren't already in the list
            const existingIds = new Set(finalData.map(t => t.id))
            const newChildren = children.filter((c: any) => !existingIds.has(c.id))
            finalData = [...finalData, ...newChildren]
        }
    }

    // Transform to flat structure
    const mappedTasks = finalData.map(task => ({
        ...task,
        tags: task.task_tags.map((tt: any) => tt.tags).filter((t: any) => t !== null && t !== undefined),
        subtasks_count: task.subtasks?.[0]?.count
    })) as TaskWithTags[]

    // Post-fetch filtering for tags if needed (for completed view)
    if (filter.type === 'completed' && filter.tags && filter.tags.length > 0) {
        return mappedTasks.filter(task =>
            filter.tags!.every(tagId => task.tags.some(t => t.id === tagId))
        )
    }

    return mappedTasks
}

import { useAuth } from './useAuth'

export function useTasks(filter: TaskFilter) {
    const { user } = useAuth()

    return useQuery({
        queryKey: ['tasks', filter, user?.id],
        queryFn: async () => {
            if (!user) return []
            return fetchTasks(filter)
        },
        enabled: !!user, // Only fetch when we have a user
        placeholderData: keepPreviousData
    })
}
