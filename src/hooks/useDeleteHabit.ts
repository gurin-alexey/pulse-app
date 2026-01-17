import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useDeleteHabit() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (habitId: string) => {
            const { error } = await supabase
                .from('habits')
                .update({ is_archived: true })
                .eq('id', habitId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['habits'] })
        }
    })
}
