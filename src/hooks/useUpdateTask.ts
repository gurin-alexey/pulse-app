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
            await queryClient.cancelQueries({ queryKey: ['all-tasks'] })

            // Snapshot the previous value
            const previousTask = queryClient.getQueryData<Task>(['task', taskId])
            const previousAllTasks = queryClient.getQueryData<Task[]>(['all-tasks'])

            // Optimistically update the single task
            if (previousTask) {
                queryClient.setQueryData<Task>(['task', taskId], {
                    ...previousTask,
                    ...updates,
                })
            }

            // Optimistically update the calendar list
            if (previousAllTasks) {
                queryClient.setQueryData<Task[]>(['all-tasks'], (old) =>
                    old?.map(task =>
                        task.id === taskId ? { ...task, ...updates } : task
                    ) || []
                )
            }

            return { previousTask, previousAllTasks }
        },
        onError: (_err, { taskId }, context) => {
            if (context?.previousTask) {
                queryClient.setQueryData(['task', taskId], context.previousTask)
            }
            if (context?.previousAllTasks) {
                queryClient.setQueryData(['all-tasks'], context.previousAllTasks)
            }
        },
        onSettled: (_data, _error, { taskId }, context) => {
            queryClient.invalidateQueries({ queryKey: ['task', taskId] })
            queryClient.invalidateQueries({ queryKey: ['tasks'] }) // Invalidate all lists to be safe
            queryClient.invalidateQueries({ queryKey: ['all-tasks'] }) // Invalidate calendar view
        },
    })
}
