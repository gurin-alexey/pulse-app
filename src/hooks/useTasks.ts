import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, Tag } from '@/types/database'

export type TaskWithTags = Task & {
    tags: Tag[]
}

export type TaskFilter =
    | { type: 'inbox', includeSubtasks?: boolean }
    | { type: 'today', includeSubtasks?: boolean }
    | { type: 'tomorrow', includeSubtasks?: boolean }
    | { type: 'project', projectId: string, includeSubtasks?: boolean }
    | { type: 'trash' }
    | { type: 'all', includeSubtasks?: boolean }
    | { type: 'is_project' }

export async function fetchTasks(filter: TaskFilter) {
    let query = supabase
        .from('tasks')
        .select('*, task_tags(tags(*))')

    if (filter.type === 'trash') {
        query = query.order('deleted_at', { ascending: false })
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
        query = query.eq('due_date', targetDateStr)
    } else if (filter.type === 'is_project') {
        query = query.eq('is_project', true)
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
    return finalData.map(task => ({
        ...task,
        tags: task.task_tags.map((tt: any) => tt.tags)
    })) as TaskWithTags[]
}

export function useTasks(filter: TaskFilter) {
    return useQuery({
        queryKey: ['tasks', filter],
        queryFn: () => fetchTasks(filter),
        enabled: true // Always enabled for these generic filters
    })
}
