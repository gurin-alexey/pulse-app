import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

type CreateTaskParams = {
    title: string
    projectId: string
    userId: string
}

/**
 * Mutation hook to create a new task.
 * Automatically invalidates the 'tasks' query query to refresh the list.
 */
export function useCreateTask() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ title, projectId, userId }: CreateTaskParams) => {
            const { data, error } = await supabase
                .from('tasks')
                .insert({
                    title,
                    project_id: projectId,
                    user_id: userId
                })
                .select()
                .single()

            if (error) throw error
            return data as Task
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tasks', variables.projectId] })
        },
    })
}
