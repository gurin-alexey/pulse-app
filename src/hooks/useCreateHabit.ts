import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Habit } from '@/types/database'

type CreateHabitParams = {
    name: string
    userId: string
    emoji?: string | null
    color?: string | null
}

export function useCreateHabit() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ name, userId, emoji = null, color = null }: CreateHabitParams) => {
            const { data, error } = await supabase
                .from('habits')
                .insert([{
                    name,
                    user_id: userId,
                    emoji,
                    color
                }])
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
