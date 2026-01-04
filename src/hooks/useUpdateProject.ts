import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/database'

export function useUpdateProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ projectId, updates }: { projectId: string, updates: Partial<Project> }) => {
            const { data, error } = await supabase
                .from('projects')
                .update(updates)
                .eq('id', projectId)
                .select()
                .single()

            if (error) throw error
            return data as Project
        },
        onSuccess: () => {
            // Invalidate projects list to reflect group changes or renames
            queryClient.invalidateQueries({ queryKey: ['projects'] })
        }
    })
}
