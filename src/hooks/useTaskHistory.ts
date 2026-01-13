import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { TaskHistory } from '../types/database'

export function useTaskHistory(taskId: string) {
    return useQuery({
        queryKey: ['task-history', taskId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('task_history')
                .select('*')
                .eq('task_id', taskId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as TaskHistory[]
        },
        enabled: !!taskId
    })
}


export function useDeleteHistoryItem() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (historyId: string) => {
            const { error } = await supabase
                .from('task_history')
                .delete()
                .eq('id', historyId)

            if (error) throw error
        },
        onSuccess: () => {
            // Invalidate any history queries
            queryClient.invalidateQueries({ queryKey: ['task-history'] })
        }
    })
}
