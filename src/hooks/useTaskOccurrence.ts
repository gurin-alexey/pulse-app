import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface ToggleOccurrenceParams {
    taskId: string
    date: string // YYYY-MM-DD
    status: 'completed' | 'skipped' | 'archived'
}

export function useTaskOccurrence() {
    const queryClient = useQueryClient()

    const { mutate: setOccurrenceStatus } = useMutation({
        mutationFn: async ({ taskId, date, status }: ToggleOccurrenceParams) => {
            // Upsert: if exists update, else insert
            const { error } = await supabase
                .from('task_occurrences')
                .upsert(
                    { task_id: taskId, original_date: date, status },
                    { onConflict: 'task_id, original_date' }
                )

            if (error) throw error
        },
        onSuccess: (_data, { taskId, date }) => {
            queryClient.invalidateQueries({ queryKey: ['all-tasks-v2'] })
            queryClient.invalidateQueries({ queryKey: ['task_occurrences'] })
            queryClient.invalidateQueries({ queryKey: ['occurrence', taskId, date] })
        }
    })

    const { mutate: removeOccurrence } = useMutation({
        mutationFn: async ({ taskId, date }: { taskId: string, date: string }) => {
            const { error } = await supabase
                .from('task_occurrences')
                .delete()
                .eq('task_id', taskId)
                .eq('original_date', date)

            if (error) throw error
        },
        onSuccess: (_data, { taskId, date }) => {
            queryClient.invalidateQueries({ queryKey: ['all-tasks-v2'] })
            queryClient.invalidateQueries({ queryKey: ['occurrence', taskId, date] })
        }
    })

    return { setOccurrenceStatus, removeOccurrence }
}
