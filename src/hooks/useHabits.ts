import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Habit } from '@/types/database'

export function useHabits() {
    return useQuery({
        queryKey: ['habits'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('habits')
                .select('*')
                .eq('is_archived', false)
                .order('order_index')
                .order('created_at')

            if (error) throw error
            return data as Habit[]
        }
    })
}
