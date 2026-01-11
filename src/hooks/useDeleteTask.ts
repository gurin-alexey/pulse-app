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
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', taskId)

            if (error) throw error
        },
        onMutate: async (taskId) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['task', taskId] })
            await queryClient.cancelQueries({ queryKey: ['all-tasks-v2'] })
            await queryClient.cancelQueries({ queryKey: ['tasks'] })
            await queryClient.cancelQueries({ queryKey: ['subtasks'] })

            // Snapshot previous value
            const previousAllTasks = queryClient.getQueryData<any>(['all-tasks-v2'])

            // Snapshot all list queries
            const tasksQueries = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] })
            const subtasksQueries = queryClient.getQueriesData<Task[]>({ queryKey: ['subtasks'] })

            const modifiedLists: { queryKey: readonly unknown[], data: Task[] }[] = []

            // Helper to remove from list
            const removeFromList = (queryKey: readonly unknown[], list: Task[] | undefined) => {
                if (!list) return
                if (list.some(t => t.id === taskId)) {
                    modifiedLists.push({ queryKey, data: list })
                    queryClient.setQueryData(queryKey, list.filter(t => t.id !== taskId))
                }
            }

            // Update All Tasks (Calendar)
            if (previousAllTasks) {
                queryClient.setQueryData(['all-tasks-v2'], (old: any) => {
                    if (!old?.tasks) return old
                    return {
                        ...old,
                        tasks: old.tasks.filter((t: Task) => t.id !== taskId)
                    }
                })
            }

            // Update all found project lists
            tasksQueries.forEach(([queryKey, data]) => removeFromList(queryKey, data))

            // Update all found subtask lists
            subtasksQueries.forEach(([queryKey, data]) => removeFromList(queryKey, data))

            // Close the detail view immediately if open
            if (searchParams.get('task') === taskId) {
                const newParams = new URLSearchParams(searchParams)
                newParams.delete('task')
                setSearchParams(newParams)
            }

            return { previousAllTasks, modifiedLists }
        },
        onError: (_err, _taskId, context) => {
            // Rollback
            if (context?.previousAllTasks) {
                queryClient.setQueryData(['all-tasks-v2'], context.previousAllTasks)
            }
            context?.modifiedLists.forEach(({ queryKey, data }) => {
                queryClient.setQueryData(queryKey, data)
            })
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['all-tasks-v2'] })
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['subtasks'] })
        },
    })
}
