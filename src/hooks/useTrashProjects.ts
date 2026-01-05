import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/database'

export function useTrashProjects() {
    return useQuery({
        queryKey: ['projects', { type: 'trash' }],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .not('deleted_at', 'is', null)
                .order('deleted_at', { ascending: false })

            if (error) throw error
            return data as Project[]
        }
    })
}
