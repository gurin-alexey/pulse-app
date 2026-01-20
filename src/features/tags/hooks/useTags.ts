import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tag } from '@/types/database'

export function useTags() {
    return useQuery({
        queryKey: ['tags'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tags')
                .select('*')
                .order('name')

            if (error) throw error
            return data as Tag[]
        }
    })
}

export function useTaskTags(taskId: string) {
    return useQuery({
        queryKey: ['task-tags', taskId],
        queryFn: async () => {
            // Join task_tags with tags to get tag details
            const { data, error } = await supabase
                .from('task_tags')
                .select('tag_id, tags(*)')
                .eq('task_id', taskId)

            if (error) throw error

            // Flatten structure: we want a list of Tags
            // data is like [{ tag_id: '...', tags: { id: '...', name: '...' } }, ...]
            return data.map(item => item.tags) as unknown as Tag[]
        },
        enabled: !!taskId
    })
}
