import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'react-router-dom'

export function useDeleteTask() {
    const queryClient = useQueryClient()
    const [searchParams, setSearchParams] = useSearchParams()

    return useMutation({
        mutationFn: async (taskId: string) => {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId)

            if (error) throw error
        },
        onSuccess: (_, taskId) => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] })

            // If the deleted task is currently open in details, close it
            if (searchParams.get('task') === taskId) {
                const newParams = new URLSearchParams(searchParams)
                newParams.delete('task')
                setSearchParams(newParams)
            }
        },
    })
}
