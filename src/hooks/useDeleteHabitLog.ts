import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useDeleteHabitLog() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (logId: string) => {
            const { error } = await supabase
                .from('habit_logs')
                .delete()
                .eq('id', logId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['habit-logs'] })
        }
    })
}
