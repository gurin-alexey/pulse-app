import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/database'
/**
 * Fetches all projects for the current user, ordered by name.
 * Uses Supabase client directly.
 */
export function useProjects() {
    return useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .order('name')

            if (error) throw error
            return data as Project[]
        }
    })
}
