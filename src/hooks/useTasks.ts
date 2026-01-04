import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

/**
 * Fetches tasks for a specific project.
 * @param projectId - The UUID of the project to fetch tasks for.
 */
export function useTasks(projectId: string | undefined) {
    return useQuery({
        queryKey: ['tasks', projectId],
        queryFn: async () => {
            if (!projectId) return []

            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as Task[]
        },
        enabled: !!projectId
    })
}
