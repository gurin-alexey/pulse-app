import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

type UpdateTaskParams = {
    taskId: string
    updates: Partial<Task>
}

export function useUpdateTask() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ taskId, updates }: UpdateTaskParams) => {
            const { data, error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', taskId)
                .select()
                .single()

            if (error) throw error
            return data as Task
        },
        onMutate: async ({ taskId, updates }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['task', taskId] })

            // Snapshot the previous value
            const previousTask = queryClient.getQueryData<Task>(['task', taskId])

            // Optimistically update the task
            if (previousTask) {
                queryClient.setQueryData<Task>(['task', taskId], {
                    ...previousTask,
                    ...updates,
                })
            }

            // Also update the list if project_id is available (approximate)
            // Note: We might miss updating the list if we don't know the query key exactly, 
            // but invalidation onSettled will fix it eventually.

            return { previousTask }
        },
        onError: (_err, { taskId }, context) => {
            if (context?.previousTask) {
                queryClient.setQueryData(['task', taskId], context.previousTask)
            }
        },
        onSettled: (_data, _error, { taskId }, context) => {
            queryClient.invalidateQueries({ queryKey: ['task', taskId] })
            queryClient.invalidateQueries({ queryKey: ['tasks'] }) // Invalidate all lists to be safe
        },
    })
}
