import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { HabitLog } from '@/types/database'

type UpsertHabitLogParams = {
    habitId: string
    userId: string
    logDate: string
    status: 'done' | 'missed' | 'skipped'
    note?: string | null
}

export function useUpsertHabitLog() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ habitId, userId, logDate, status, note = null }: UpsertHabitLogParams) => {
            const { data, error } = await supabase
                .from('habit_logs')
                .upsert([{
                    habit_id: habitId,
                    user_id: userId,
                    log_date: logDate,
                    status,
                    note
                }], { onConflict: 'habit_id,log_date' })
                .select()
                .single()

            if (error) throw error
            return data as HabitLog
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['habit-logs'] })
        }
    })
}
