import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { HabitLog } from '@/types/database'

type HabitLogsFilter = {
    from: string
    to: string
    habitId?: string
}

export function useHabitLogs({ from, to, habitId }: HabitLogsFilter) {
    return useQuery({
        queryKey: ['habit-logs', { from, to, habitId }],
        queryFn: async () => {
            let query = supabase
                .from('habit_logs')
                .select('*')
                .gte('log_date', from)
                .lte('log_date', to)
                .order('log_date', { ascending: false })

            if (habitId) {
                query = query.eq('habit_id', habitId)
            }

            const { data, error } = await query
            if (error) throw error
            return data as HabitLog[]
        }
    })
}
