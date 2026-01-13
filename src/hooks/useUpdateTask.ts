import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

type UpdateTaskParams = {
    taskId: string
    updates: Partial<Task>
}

export function useUpdateTask() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (vars: UpdateTaskParams) => {
            let { taskId, updates } = vars

            // 0. Reverse Cascade (Child -> Parent Move)
            // If dragging a child to a new list (Project/Section), move the Root Parent instead.
            // This ensures the whole "Task Family" moves together, satisfying user intent.
            const isLocationChange = updates.project_id !== undefined || updates.section_id !== undefined

            // ONLY apply if this is a move, and we are NOT explicitly reparenting (moving to a new parent)
            if (isLocationChange && !updates.parent_id) {
                const getRoot = async (id: string): Promise<string> => {
                    const { data } = await supabase.from('tasks').select('id, parent_id').eq('id', id).maybeSingle()
                    if (data?.parent_id) return getRoot(data.parent_id)
                    return data?.id || id
                }

                const rootId = await getRoot(taskId)

                if (rootId !== taskId) {
                    // We are a child. Switch target to Root.
                    taskId = rootId

                    // If the drag-and-drop logic tried to detach us (parent_id: null),
                    // ignore that instruction because we are moving the whole family, maintaining structure.
                    if (updates.parent_id === null) {
                        const { parent_id, ...rest } = updates
                        updates = rest
                    }
                }
            }

            // 1. Completion logic
            if (updates.is_completed !== undefined) {
                updates.completed_at = updates.is_completed ? new Date().toISOString() : null
            }

            // 2. Context Inheritance (when nesting)
            // If moving under a new parent, inherit its project/section/date
            if (updates.parent_id) {
                const { data: parentTask } = await supabase
                    .from('tasks')
                    .select('project_id, section_id, due_date')
                    .eq('id', updates.parent_id)
                    .single()

                if (parentTask) {
                    updates.project_id = parentTask.project_id
                    updates.section_id = parentTask.section_id
                    // We don't force due_date inheritance to allow sub-scheduling,
                    // but we do ensure the task is in the same project container.
                }
            }

            // 3. Perform the primary update
            const { data: primaryTask, error: primaryError } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', taskId)
                .select()
                .single()

            if (primaryError) throw primaryError

            // 4. Waterfall Cascade to descendants
            // Fields that MUST follow the parent to keep the branch together
            const cascadeFields = ['project_id', 'section_id', 'deleted_at'] as const
            const cascadeUpdates: any = {}
            let needsCascade = false

            cascadeFields.forEach(field => {
                if (updates[field] !== undefined) {
                    cascadeUpdates[field] = updates[field]
                    needsCascade = true
                }
            })

            if (needsCascade) {
                // Recursive function to update all children of a parent
                const cascadeToDescendants = async (parentId: string) => {
                    const { data: children, error: fetchError } = await supabase
                        .from('tasks')
                        .select('id')
                        .eq('parent_id', parentId)

                    if (fetchError) throw fetchError

                    if (children && children.length > 0) {
                        const childIds = children.map(c => c.id)

                        // Update this level
                        const { error: updateError } = await supabase
                            .from('tasks')
                            .update(cascadeUpdates)
                            .in('id', childIds)

                        if (updateError) throw updateError

                        // Recurse to next level
                        for (const id of childIds) {
                            await cascadeToDescendants(id)
                        }
                    }
                }

                await cascadeToDescendants(taskId)
            }

            return primaryTask as Task
        },
        onMutate: async (vars) => {
            let { taskId, updates } = vars

            // Cancel outgoing refetches (we need to cancel generally since we might switch IDs)
            await queryClient.cancelQueries({ queryKey: ['tasks'] })
            await queryClient.cancelQueries({ queryKey: ['subtasks'] })
            await queryClient.cancelQueries({ queryKey: ['all-tasks-v2'] })
            // We'll cancel specific detail queries after we resolve ID

            // 0. PREPARE CACHE SNAPSHOTS (Need this first to find Root)
            // We need to find the task in ANY specific project list to update it optimistically
            const tasksQueries = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] })
            const subtasksQueries = queryClient.getQueriesData<Task[]>({ queryKey: ['subtasks'] })
            const previousAllTasks = queryClient.getQueryData<any>(['all-tasks-v2'])

            // Also check if the task is currently open in detail view (and thus cached individually)
            // This is crucial if the task isn't in any visible list but is open in a modal
            const initialDetail = queryClient.getQueryData<Task>(['task', taskId])

            // Flatten cache for lookup
            const allCachedTasks: Task[] = []
            const seenIds = new Set<string>()

            const addTasks = (list: (Task | undefined)[] | undefined) => {
                if (!Array.isArray(list)) return
                list.forEach(t => {
                    if (t && !seenIds.has(t.id)) {
                        allCachedTasks.push(t)
                        seenIds.add(t.id)
                    }
                })
            }

            addTasks(previousAllTasks?.tasks)
            tasksQueries.forEach(([_, data]) => addTasks(data))
            subtasksQueries.forEach(([_, data]) => addTasks(data))
            // Ensure the task itself is in our lookup set
            if (initialDetail) addTasks([initialDetail])

            // 0.5 REVERSE CASCADE LOGIC (Optimistic)
            const isLocationChange = updates.project_id !== undefined || updates.section_id !== undefined
            if (isLocationChange && !updates.parent_id) {
                const findRoot = (id: string): string => {
                    const t = allCachedTasks.find(x => x.id === id)
                    if (t?.parent_id) return findRoot(t.parent_id)
                    return id
                }
                const rootId = findRoot(taskId)

                if (rootId !== taskId) {
                    taskId = rootId
                    // Ignore detach from optimistic update too
                    if (updates.parent_id === null) {
                        const { parent_id, ...rest } = updates
                        updates = rest
                    }
                }
            }

            // Now cancel specific query for the EFFECTIVE task ID (Root)
            await queryClient.cancelQueries({ queryKey: ['task', taskId] })
            const previousTask = queryClient.getQueryData<Task>(['task', taskId])

            // Store snapshots of all modified lists
            const modifiedLists: { queryKey: readonly unknown[], data: Task[] }[] = []

            // 2. Helper to get all descendant IDs (using effective taskId)
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
            // Positional/Individual fields should ONLY apply to the primary task
            const individualFields = ['parent_id', 'sort_order', 'title', 'is_completed', 'due_date']
            const positionalUpdates: any = {}
            const contextualUpdates: any = {}

            Object.entries(updates).forEach(([key, value]) => {
                if (individualFields.includes(key)) {
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

                // Determine if a task matches this list's filter
                const matchesFilter = (task: any) => {
                    // Deleted/Trash logic
                    if (filter.type === 'trash') return task.deleted_at !== null
                    if (task.deleted_at !== null) return false

                    // Project/Inbox/Today logic
                    if (filter.type === 'project') return task.project_id === filter.projectId
                    if (filter.type === 'inbox') return task.project_id === null
                    if (filter.type === 'today') {
                        const today = new Date().toISOString().split('T')[0]
                        return task.due_date === today
                    }
                    return true
                }

                // Snapshots of the primary task and its descendants after the proposed update
                // Note: taskId here is the Root (if switched)
                const currentPrimary = allCachedTasks.find(t => t.id === taskId)
                if (!currentPrimary) return // Should not happen if cache is consistent

                const updatedPrimary = { ...currentPrimary, ...positionalUpdates, ...contextualUpdates } as Task
                const updatedDescendants = descendantIds.map(did => {
                    const original = allCachedTasks.find(t => t.id === did)
                    return original ? { ...original, ...contextualUpdates } : null
                }).filter(Boolean) as Task[]

                const shouldPrimaryBeInList = matchesFilter(updatedPrimary)
                const hasPrimary = list.some(t => t.id === taskId)
                const hasDescendants = list.some(t => descendantIds.includes(t.id))

                if (hasPrimary || hasDescendants || (shouldPrimaryBeInList && filter.type)) {
                    modifiedLists.push({ queryKey, data: list })

                    // Start with the list, replacing any existing versions of A or B
                    let newList = list.map(t => {
                        if (t.id === taskId) return updatedPrimary
                        if (descendantIds.includes(t.id)) {
                            return { ...t, ...contextualUpdates }
                        }
                        return t
                    })

                    // Migration Logic
                    if (shouldPrimaryBeInList && !hasPrimary && filter.type) {
                        // ADD whole branch to the new list if it's missing the primary
                        newList = [...newList, updatedPrimary, ...updatedDescendants.filter(ud => !newList.some(t => t.id === ud.id))]
                    } else if (!shouldPrimaryBeInList && hasPrimary) {
                        // REMOVE whole branch from the old list if primary no longer matches
                        newList = newList.filter(t => t.id !== taskId && !descendantIds.includes(t.id))
                    }

                    queryClient.setQueryData(queryKey, newList)
                }
            }

            // Update All Tasks (Calendar/Global)
            if (previousAllTasks) {
                queryClient.setQueryData(['all-tasks-v2'], (old: any) => {
                    if (!old?.tasks) return old
                    return {
                        ...old,
                        tasks: old.tasks.map((t: Task) => {
                            if (t.id === taskId) return { ...t, ...positionalUpdates, ...contextualUpdates }
                            if (descendantIds.includes(t.id)) return { ...t, ...contextualUpdates }
                            return t
                        })
                    }
                })
            }

            // Update individual task detail cache (for Root)
            if (previousTask) {
                queryClient.setQueryData<Task>(['task', taskId], { ...previousTask, ...positionalUpdates, ...contextualUpdates })
            }

            // Update individual descendant detail caches (crucial for UI feedback if a child is the active view)
            // This ensures that the "Project Picker" in TaskDetail updates instantly when the child is dragged
            descendantIds.forEach(descId => {
                const prevDesc = queryClient.getQueryData<Task>(['task', descId])
                if (prevDesc) {
                    queryClient.setQueryData<Task>(['task', descId], { ...prevDesc, ...contextualUpdates })
                }
            })

            // Apply updates to all relevant project/smart lists
            tasksQueries.forEach(([queryKey, data]) => updateList(queryKey, data))
            subtasksQueries.forEach(([queryKey, data]) => updateList(queryKey, data))

            return { previousTask, previousAllTasks, modifiedLists, effectiveTaskId: taskId }
        },
        onSuccess: (_data, { updates }) => {
            if (updates.is_completed === true) {
                const messages = [
                    "Отличная работа! 🚀",
                    "Так держать! 🔥",
                    "Еще одна задача готова! ✅",
                    "Продуктивность на высоте! 📈",
                    "Шаг за шагом к цели! 🎯",
                    "Превосходно! ⭐",
                    "Ты справляешься! 💪",
                    "Молодец! 👏",
                    "Задача выполнена! 🎉",
                    "Вперед к новым вершинам! 🏔️"
                ]
                const randomMessage = messages[Math.floor(Math.random() * messages.length)]
                toast.success(randomMessage, {
                    duration: 3000,
                    className: "font-medium"
                })
            }
        },
        onError: (err, _vars, context) => {
            // Restore using the effective ID (which might be the Root if we switched)
            const idToRestore = context?.effectiveTaskId || _vars.taskId

            console.error("Mutation failed for task", idToRestore, err)
            // alert(`Failed to update task: ${err.message}`) // Optional, toast handles errors usually?

            if (context?.previousTask) {
                queryClient.setQueryData(['task', idToRestore], context.previousTask)
            }
            if (context?.previousAllTasks) {
                queryClient.setQueryData(['all-tasks-v2'], context.previousAllTasks)
            }
            // Rollback all modified lists
            context?.modifiedLists.forEach(({ queryKey, data }) => {
                queryClient.setQueryData(queryKey, data)
            })
        },
        onSettled: (_data, _error, _vars, context) => {
            const idToInvalidate = context?.effectiveTaskId || _vars.taskId

            queryClient.invalidateQueries({ queryKey: ['task', idToInvalidate] })
            queryClient.invalidateQueries({ queryKey: ['tasks'] }) // Invalidate all lists to be safe
            queryClient.invalidateQueries({ queryKey: ['all-tasks-v2'] }) // Invalidate calendar view
            queryClient.invalidateQueries({ queryKey: ['subtasks'] })
            queryClient.invalidateQueries({ queryKey: ['task-history', idToInvalidate] })
        },
    })
}
