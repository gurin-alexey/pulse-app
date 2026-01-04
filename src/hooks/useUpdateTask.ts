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
            await queryClient.cancelQueries({ queryKey: ['tasks'] })
            await queryClient.cancelQueries({ queryKey: ['subtasks'] })

            // Snapshot the previous value
            const previousTask = queryClient.getQueryData<Task>(['task', taskId])
            const previousAllTasks = queryClient.getQueryData<Task[]>(['all-tasks'])

            // We need to find the task in ANY specific project list to update it optimistically
            // and to know which list to rollback
            const tasksQueries = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] })
            const subtasksQueries = queryClient.getQueriesData<Task[]>({ queryKey: ['subtasks'] })

            // Store snapshots of all modified lists
            const modifiedLists: { queryKey: readonly unknown[], data: Task[] }[] = []

            // Helper to update a list if it contains the task
            const updateList = (queryKey: readonly unknown[], list: Task[] | undefined) => {
                if (!list) return
                const processedList = list // Copy not needed for find, but needed for setQueryData
                if (processedList.some(t => t.id === taskId)) {
                    modifiedLists.push({ queryKey, data: processedList })
                    queryClient.setQueryData(queryKey, processedList.map(t =>
                        t.id === taskId ? { ...t, ...updates } : t
                    ))
                }
            }

            // Update All Tasks (Calendar)
            if (previousAllTasks) {
                queryClient.setQueryData<Task[]>(['all-tasks'], old =>
                    old?.map(t => t.id === taskId ? { ...t, ...updates } : t) || []
                )
            }

            // Update 'task'
            if (previousTask) {
                queryClient.setQueryData<Task>(['task', taskId], { ...previousTask, ...updates })
            }

            // Update all found project lists
            tasksQueries.forEach(([queryKey, data]) => updateList(queryKey, data))

            // Update all found subtask lists
            subtasksQueries.forEach(([queryKey, data]) => updateList(queryKey, data))

            return { previousTask, previousAllTasks, modifiedLists }
        },
        onError: (err, { taskId }, context) => {
            console.error("Mutation failed for task", taskId, err)
            alert(`Failed to update task: ${err.message}`)

            if (context?.previousTask) {
                queryClient.setQueryData(['task', taskId], context.previousTask)
            }
            if (context?.previousAllTasks) {
                queryClient.setQueryData(['all-tasks'], context.previousAllTasks)
            }
            // Rollback all modified lists
            context?.modifiedLists.forEach(({ queryKey, data }) => {
                queryClient.setQueryData(queryKey, data)
            })
        },
        onSettled: (_data, _error, { taskId }, context) => {
            queryClient.invalidateQueries({ queryKey: ['task', taskId] })
            queryClient.invalidateQueries({ queryKey: ['tasks'] }) // Invalidate all lists to be safe
            queryClient.invalidateQueries({ queryKey: ['all-tasks'] }) // Invalidate calendar view

            // If we have the updated data and it has a parent_id, invalidate that specific subtask list
            // But 'data' arg in onSettled might be undefined if error?
            // Safer to just invalidate all subtasks for now or let the UI handle optimistic updates locally.
            // Actually, let's just use fuzzy invalidation for all subtasks to be safe and simple.
            queryClient.invalidateQueries({ queryKey: ['subtasks'] })
        },
    })
}
