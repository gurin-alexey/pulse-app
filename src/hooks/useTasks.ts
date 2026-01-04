import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, Tag } from '@/types/database'

export type TaskWithTags = Task & {
    tags: Tag[]
}

export type TaskFilter =
    | { type: 'project', projectId: string }
    | { type: 'inbox' }
    | { type: 'today' }

export function useTasks(filter: TaskFilter) {
    return useQuery({
        queryKey: ['tasks', filter],
        queryFn: async () => {
            let query = supabase
                .from('tasks')
                .select('*, task_tags(tags(*))')
                .is('parent_id', null)
                .order('created_at', { ascending: false })

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
        },
        enabled: true // Always enabled for these generic filters
    })
}
