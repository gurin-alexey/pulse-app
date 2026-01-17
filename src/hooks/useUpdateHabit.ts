import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Habit } from '@/types/database'

export function useUpdateHabit() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ habitId, updates }: { habitId: string, updates: Partial<Habit> }) => {
            const { data, error } = await supabase
                .from('habits')
                .update(updates)
                .eq('id', habitId)
                .select()
                .single()

            if (error) throw error
            return data as Habit
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['habits'] })
        }
    })
}
