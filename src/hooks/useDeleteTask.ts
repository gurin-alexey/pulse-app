import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'react-router-dom'
import type { Task } from '@/types/database'

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
        onMutate: async (taskId) => {
            // Cancel potential refetches
            await queryClient.cancelQueries({ queryKey: ['all-tasks'] })

            // Try to find the task to know its project_id for list updates
            let task = queryClient.getQueryData<Task>(['task', taskId])
            if (!task) {
                const allTasks = queryClient.getQueryData<Task[]>(['all-tasks'])
                task = allTasks?.find(t => t.id === taskId)
            }

            if (task?.project_id) {
                await queryClient.cancelQueries({ queryKey: ['tasks', task.project_id] })
            }

            // Snapshot previous values
            const previousAllTasks = queryClient.getQueryData<Task[]>(['all-tasks'])
            const previousProjectTasks = task?.project_id
                ? queryClient.getQueryData<Task[]>(['tasks', task.project_id])
                : undefined

            // Optimistically update Calendar (all-tasks)
            queryClient.setQueryData<Task[]>(['all-tasks'], (old) =>
                old ? old.filter(t => t.id !== taskId) : []
            )

            // Optimistically update Project List
            if (task?.project_id) {
                queryClient.setQueryData<Task[]>(['tasks', task.project_id], (old) =>
                    old ? old.filter(t => t.id !== taskId) : []
                )
            }

            // Close the detail view immediately if open
            if (searchParams.get('task') === taskId) {
                const newParams = new URLSearchParams(searchParams)
                newParams.delete('task')
                setSearchParams(newParams)
            }

            return { previousAllTasks, previousProjectTasks, projectId: task?.project_id }
        },
        onError: (_err, _taskId, context) => {
            // Rollback
            if (context?.previousAllTasks) {
                queryClient.setQueryData(['all-tasks'], context.previousAllTasks)
            }
            if (context?.projectId && context?.previousProjectTasks) {
                queryClient.setQueryData(['tasks', context.projectId], context.previousProjectTasks)
            }
        },
        onSettled: (_data, _error, _taskId, context) => {
            queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            if (context?.projectId) {
                queryClient.invalidateQueries({ queryKey: ['tasks', context.projectId] })
            }
        },
    })
}
