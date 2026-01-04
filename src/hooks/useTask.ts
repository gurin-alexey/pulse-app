import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

export function useTask(taskId: string | null) {
    return useQuery({
        queryKey: ['task', taskId],
        queryFn: async () => {
            if (!taskId) return null

            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('id', taskId)
                .single()

            if (error) throw error
            return data as Task
        },
        enabled: !!taskId
    })
}
