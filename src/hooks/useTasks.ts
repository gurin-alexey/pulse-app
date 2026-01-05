import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, Tag } from '@/types/database'

export type TaskWithTags = Task & {
    tags: Tag[]
}

export type TaskFilter =
    | { type: 'inbox', includeSubtasks?: boolean }
    | { type: 'today', includeSubtasks?: boolean }
    | { type: 'project', projectId: string, includeSubtasks?: boolean }
    | { type: 'trash' }

export async function fetchTasks(filter: TaskFilter) {
    let query = supabase
        .from('tasks')
        .select('*, task_tags(tags(*))')
        .order('created_at', { ascending: false })

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
    } else if (filter.type === 'today') {
        const today = new Date().toISOString().split('T')[0]
        query = query.eq('due_date', today)
    }

    const { data, error } = await query

    if (error) throw error

    // Transform to flat structure
    return (data as any[]).map(task => ({
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
