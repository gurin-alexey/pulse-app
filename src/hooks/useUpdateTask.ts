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

            // 1. If parent_id is changing to a non-null value, inherit parent's context
            if (updates.parent_id) {
                const { data: parentTask } = await supabase
                    .from('tasks')
                    .select('project_id, section_id, due_date')
                    .eq('id', updates.parent_id)
                    .single()

                if (parentTask) {
                    updates.project_id = parentTask.project_id
                    updates.section_id = parentTask.section_id
                    // We don't overwrite due_date here as it might be specific, 
                    // but we do inherit the project "location".
                }
            }

            // 2. Perform the primary update
            const { data, error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', taskId)
                .select()
                .single()

            if (error) throw error

            // 3. Cascade critical fields to descendants
            // We cascade: project_id, section_id, due_date, deleted_at
            const fieldsToCascade = ['project_id', 'section_id', 'due_date', 'deleted_at'] as const
            const cascadeUpdates: any = {}
            let shouldCascade = false

            fieldsToCascade.forEach(field => {
                if (updates[field] !== undefined) {
                    cascadeUpdates[field] = updates[field]
                    shouldCascade = true
                }
            })

            if (shouldCascade) {
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

            // 1. Gather all unique tasks from all cached queries for descendant lookup
            const allCachedTasks: Task[] = []
            const seenIds = new Set<string>()

            const queries = [
                previousAllTasks || [],
                ...(tasksQueries.flatMap(([_, data]) => data || [])),
                ...(subtasksQueries.flatMap(([_, data]) => data || []))
            ]

            queries.forEach((item: Task | Task[]) => {
                const list = Array.isArray(item) ? item : [item]
                list.forEach((t: Task) => {
                    if (!seenIds.has(t.id)) {
                        allCachedTasks.push(t)
                        seenIds.add(t.id)
                    }
                })
            })

            // 2. Helper to get all descendant IDs
            const getDescendantIds = (parentId: string, tasksToSearch: Task[]): string[] => {
                const children = tasksToSearch.filter(t => t.parent_id === parentId)
                let ids = children.map(c => c.id)
                children.forEach(c => {
                    ids = [...ids, ...getDescendantIds(c.id, tasksToSearch)]
                })
                return ids
            }

            const descendantIds = getDescendantIds(taskId, allCachedTasks)

            // 3. Separate updates
            // Positional fields should ONLY apply to the primary task
            const positionalFields = ['parent_id', 'sort_order', 'title', 'is_completed']
            const positionalUpdates: any = {}
            const contextualUpdates: any = {}

            Object.entries(updates).forEach(([key, value]) => {
                if (positionalFields.includes(key)) {
                    positionalUpdates[key] = value
                } else {
                    contextualUpdates[key] = value
                }
            })

            // If moving to a new parent, try to infer project/section from that parent in cache
            if (updates.parent_id) {
                const parentInCache = allCachedTasks.find(t => t.id === updates.parent_id)
                if (parentInCache) {
                    contextualUpdates.project_id = parentInCache.project_id
                    contextualUpdates.section_id = parentInCache.section_id
                }
            }

            // 4. Helper to update a list
            const updateList = (queryKey: readonly unknown[], list: Task[] | undefined) => {
                if (!list) return
                const filter = (queryKey[1] as any) || {}

                // Determine if the updated primary task should be in THIS list
                const matchesFilter = (task: any) => {
                    if (filter.type === 'project') return task.project_id === filter.projectId
                    if (filter.type === 'inbox') return task.project_id === null
                    if (filter.type === 'today') {
                        const today = new Date().toISOString().split('T')[0]
                        return task.due_date === today
                    }
                    return true // default for others
                }

                const updatedPrimary = { ...allCachedTasks.find(t => t.id === taskId), ...positionalUpdates, ...contextualUpdates } as Task
                const shouldBeInList = matchesFilter(updatedPrimary)

                const hasPrimary = list.some(t => t.id === taskId)
                const hasDescendants = list.some(t => descendantIds.includes(t.id))

                if (hasPrimary || hasDescendants || (shouldBeInList && filter.type)) {
                    modifiedLists.push({ queryKey, data: list })

                    let newList = list.map(t => {
                        if (t.id === taskId) return updatedPrimary
                        if (descendantIds.includes(t.id)) return { ...t, ...contextualUpdates }
                        return t
                    })

                    // Handle Migration (Add/Remove)
                    if (shouldBeInList && !hasPrimary && filter.type) {
                        // ADD to new list (approximate position)
                        newList = [...newList, updatedPrimary]
                        // Also add descendants to the new list cache if they aren't there
                        descendantIds.forEach(did => {
                            if (!newList.some(t => t.id === did)) {
                                const dTask = allCachedTasks.find(t => t.id === did)
                                if (dTask) newList.push({ ...dTask, ...contextualUpdates })
                            }
                        })
                    } else if (!shouldBeInList && hasPrimary) {
                        // REMOVE from old list
                        newList = newList.filter(t => t.id !== taskId && !descendantIds.includes(t.id))
                    }

                    queryClient.setQueryData(queryKey, newList)
                }
            }

            // Update All Tasks (Calendar)
            if (previousAllTasks) {
                queryClient.setQueryData<Task[]>(['all-tasks'], old =>
                    old?.map(t => {
                        if (t.id === taskId) return { ...t, ...positionalUpdates, ...contextualUpdates }
                        if (descendantIds.includes(t.id)) return { ...t, ...contextualUpdates }
                        return t
                    }) || []
                )
            }

            // Update 'task' (Detail view)
            if (previousTask) {
                queryClient.setQueryData<Task>(['task', taskId], { ...previousTask, ...positionalUpdates, ...contextualUpdates })
            }

            // Update project/subtask lists
            tasksQueries.forEach(([queryKey, data]) => updateList(queryKey, data))
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
