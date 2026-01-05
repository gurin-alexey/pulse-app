import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useDeleteProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (projectId: string) => {
            const { error } = await supabase
                .from('projects')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', projectId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
        }
    })
}
