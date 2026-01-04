import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, Tag } from '@/types/database'

export type TaskWithTags = Task & {
    tags: Tag[]
}

export function useTasks(projectId: string | undefined) {
    return useQuery({
        queryKey: ['tasks', projectId],
        queryFn: async () => {
            if (!projectId) return []

            const { data, error } = await supabase
                .from('tasks')
                .select('*, task_tags(tags(*))')
                .eq('project_id', projectId)
                .is('parent_id', null)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Transform to flat structure
            return (data as any[]).map(task => ({
                ...task,
                tags: task.task_tags.map((tt: any) => tt.tags)
            })) as TaskWithTags[]
        },
        enabled: !!projectId
    })
}
