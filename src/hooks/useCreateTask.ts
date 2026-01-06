import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'
import type { TaskFilter, TaskWithTags } from '@/hooks/useTasks'

type CreateTaskParams = {
    id?: string
    title: string
    projectId: string | null
    userId: string
    parentId?: string | null
    sectionId?: string | null
    due_date?: string | null
    start_time?: string | null
    end_time?: string | null
    description?: string | null
    priority?: string | null
    recurrence_rule?: string | null
}

const isToday = (dateStr: string | null) => {
    if (!dateStr) return false
    const today = new Date().toISOString().split('T')[0]
    return dateStr === today
}

export function useCreateTask() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, title, projectId, userId, parentId, sectionId, due_date, start_time, end_time, description, priority, recurrence_rule }: CreateTaskParams) => {
            const { data, error } = await supabase
                .from('tasks')
                .insert({
                    id,
                    title,
                    project_id: projectId || null,
                    user_id: userId,
                    parent_id: parentId || null,
                    section_id: sectionId || null,
                    due_date: due_date || null,
                    start_time: start_time || null,
                    end_time: end_time || null,
                    description: description || null,
                    priority: priority || 'low',
                    recurrence_rule: recurrence_rule || null,
                    sort_order: -Date.now() // Ensure new tasks appear at the top
                })
                .select()
                .single()

            if (error) throw error
            return data as Task
        },
        onMutate: async (newTodo) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['tasks'] })

            // Snapshot
            const previousQueries = queryClient.getQueriesData({ queryKey: ['tasks'] })

            // Create Optimistic Task
            const tempId = newTodo.id || crypto.randomUUID()
            const optimisticTask: TaskWithTags = {
                id: tempId,
                title: newTodo.title,
                project_id: newTodo.projectId || null,
                user_id: newTodo.userId,
                parent_id: newTodo.parentId || null,
                section_id: newTodo.sectionId || null,
                due_date: newTodo.due_date || null,
                start_time: newTodo.start_time || null,
                end_time: newTodo.end_time || null,
                description: newTodo.description || null,
                priority: (newTodo.priority as any) || 'low',
                recurrence_rule: newTodo.recurrence_rule || null,
                is_completed: false,
                is_project: false,
                created_at: new Date().toISOString(),
                sort_order: -Date.now(), // Optimistic update
                deleted_at: null,
                completed_at: null,
                tags: [] // Emtpy tags for new task
            }

            // Update caches
            previousQueries.forEach(([queryKey, oldData]) => {
                const filter = queryKey[1] as TaskFilter | undefined
                if (!filter) return

                let shouldAdd = false
                if (filter.type === 'inbox' && !optimisticTask.project_id) shouldAdd = true
                if (filter.type === 'project' && filter.projectId === optimisticTask.project_id) shouldAdd = true
                if (filter.type === 'today' && isToday(optimisticTask.due_date)) shouldAdd = true

                if (shouldAdd) {
                    queryClient.setQueryData(queryKey, (old: TaskWithTags[] | undefined) => {
                        return [optimisticTask, ...(old || [])]
                    })
                }
            })

            return { previousQueries }
        },
        onError: (_err, _newTodo, context) => {
            // Rollback
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
        },
        onSuccess: (_, variables) => {
            // Invalidate to ensure consistency and fetching real ID/DB state
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
            if (variables.parentId) {
                queryClient.invalidateQueries({ queryKey: ['subtasks', variables.parentId] })
            }
        },
    })
}
