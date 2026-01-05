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
            if (updates.is_completed !== undefined) {
                updates.completed_at = updates.is_completed ? new Date().toISOString() : null
            }

            // 1. Perform the primary update
            const { data, error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', taskId)
                .select()
                .single()

            if (error) throw error

            // 2. Cascade project/section changes to descendants
            // If project_id or section_id changed, we must move all children too
            if (updates.project_id !== undefined || updates.section_id !== undefined) {
                const cascadeUpdates: any = {}
                if (updates.project_id !== undefined) cascadeUpdates.project_id = updates.project_id
                if (updates.section_id !== undefined) cascadeUpdates.section_id = updates.section_id

                // We need to recursively update all levels. 
                // Since Supabase/PostgREST doesn't support recursive updates in one call easily, 
                // we'll fetch all descendants and update them in bulk.

                const updateDescendants = async (parentId: string) => {
                    const { data: children } = await supabase
                        .from('tasks')
                        .select('id')
                        .eq('parent_id', parentId)

                    if (children && children.length > 0) {
                        const childIds = children.map(c => c.id)
                        await supabase
                            .from('tasks')
                            .update(cascadeUpdates)
                            .in('id', childIds)

                        // Recurse for each child
                        for (const childId of childIds) {
                            await updateDescendants(childId)
                        }
                    }
                }

                await updateDescendants(taskId)
            }

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

            // Helper to get all descendant IDs from a list
            const getDescendantIds = (parentId: string, allTasks: Task[]): string[] => {
                const children = allTasks.filter(t => t.parent_id === parentId)
                let ids = children.map(c => c.id)
                children.forEach(c => {
                    ids = [...ids, ...getDescendantIds(c.id, allTasks)]
                })
                return ids
            }

            const descendantIds = previousAllTasks ? getDescendantIds(taskId, previousAllTasks) : []
            const allTargetIds = [taskId, ...descendantIds]

            // Helper to update a list if it contains any of the target tasks
            const updateList = (queryKey: readonly unknown[], list: Task[] | undefined) => {
                if (!list) return
                if (list.some(t => allTargetIds.includes(t.id))) {
                    modifiedLists.push({ queryKey, data: list })
                    queryClient.setQueryData(queryKey, list.map(t =>
                        allTargetIds.includes(t.id) ? { ...t, ...updates } : t
                    ))
                }
            }

            // Update All Tasks (Calendar)
            if (previousAllTasks) {
                queryClient.setQueryData<Task[]>(['all-tasks'], old =>
                    old?.map(t => allTargetIds.includes(t.id) ? { ...t, ...updates } : t) || []
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
