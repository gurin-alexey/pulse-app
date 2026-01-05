import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

type CreateTaskParams = {
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

/**
 * Mutation hook to create a new task.
 * Automatically invalidates the 'tasks' query to refresh the list.
 */
export function useCreateTask() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ title, projectId, userId, parentId, sectionId, due_date, start_time, end_time, description, priority, recurrence_rule }: CreateTaskParams) => {
            const { data, error } = await supabase
                .from('tasks')
                .insert({
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
                    recurrence_rule: recurrence_rule || null
                })
                .select()
                .single()

            if (error) throw error
            return data as Task
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
            if (variables.parentId) {
                queryClient.invalidateQueries({ queryKey: ['subtasks', variables.parentId] })
            }
        },
    })
}
