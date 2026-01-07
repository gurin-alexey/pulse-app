import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

/**
 * Fetches subtasks for a specific parent task.
 * @param parentId - The UUID of the parent task.
 */
export function useSubtasks(parentId: string | undefined) {
    return useQuery({
        queryKey: ['subtasks', parentId],
        queryFn: async () => {
            if (!parentId) return []

            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('parent_id', parentId)
                .is('deleted_at', null)
                // Order by created_at. You might want to change this to index or is_completed later
                .order('created_at', { ascending: true })

            if (error) throw error
            return data as Task[]
        },
        enabled: !!parentId
    })
}
