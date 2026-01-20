import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'
import type { TaskWithTags } from '@/hooks/useTasks'

export function useTagTasks(tagId: string | undefined) {
    return useQuery({
        queryKey: ['tasks', 'tag', tagId],
        queryFn: async () => {
            if (!tagId) return []

            const { data, error } = await supabase
                .from('tasks')
                // Inner join to filter by tag, and fetch tag details
                .select('*, task_tags!inner(tag_id, tags(*))')
                .eq('task_tags.tag_id', tagId)
                .is('parent_id', null)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Transform to TaskWithTags structure
            // Note: This only returns the tag that we filtered by. 
            // To get ALL tags for these tasks, we'd need a different query approach, 
            // but this is sufficient for the basic list.
            return (data as any[]).map(task => ({
                ...task,
                tags: task.task_tags.map((tt: any) => tt.tags)
            })) as TaskWithTags[]
        },
        enabled: !!tagId
    })
}
