import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Section } from '@/types/database'

export function useAllSections() {
    return useQuery({
        queryKey: ['all-sections'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sections')
                .select('*')
                .order('order_index', { ascending: true })

            if (error) throw error
            return data as Section[]
        }
    })
}
