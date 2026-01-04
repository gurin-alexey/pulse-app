import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tag, TaskTag } from '@/types/database'

export function useTags() {
    return useQuery({
        queryKey: ['tags'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tags')
                .select('*')
                .order('name')

            if (error) throw error
            return data as Tag[]
        }
    })
}

export function useTaskTags(taskId: string) {
    return useQuery({
        queryKey: ['task-tags', taskId],
        queryFn: async () => {
            // Join task_tags with tags to get tag details
            const { data, error } = await supabase
                .from('task_tags')
                .select('tag_id, tags(*)')
                .eq('task_id', taskId)

            if (error) throw error

            // Flatten structure: we want a list of Tags
            // data is like [{ tag_id: '...', tags: { id: '...', name: '...' } }, ...]
            return data.map(item => item.tags) as unknown as Tag[]
        },
        enabled: !!taskId
    })
}

export function useCreateTag() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (name: string) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("User not authenticated")

            // Simple random color generator
            const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e']
            const color = colors[Math.floor(Math.random() * colors.length)]

            const { data, error } = await supabase
                .from('tags')
                .insert({
                    name,
                    user_id: user.id,
                    color
                })
                .select()
                .single()

            if (error) throw error
            return data as Tag
        },
        onSuccess: (newTag) => {
            queryClient.setQueryData<Tag[]>(['tags'], (old) => {
                return old ? [...old, newTag].sort((a, b) => a.name.localeCompare(b.name)) : [newTag]
            })
        }
    })
}

export function useToggleTaskTag() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ taskId, tagId, isAttached }: { taskId: string, tagId: string, isAttached: boolean }) => {
            if (isAttached) {
                // Delete
                const { error } = await supabase
                    .from('task_tags')
                    .delete()
                    .eq('task_id', taskId)
                    .eq('tag_id', tagId)
                if (error) throw error
                return { action: 'removed', tagId }
            } else {
                // Create
                const { error } = await supabase
                    .from('task_tags')
                    .insert({
                        task_id: taskId,
                        tag_id: tagId
                    })
                if (error) throw error
                return { action: 'added', tagId }
            }
        },
        onMutate: async ({ taskId, tagId, isAttached }) => {
            await queryClient.cancelQueries({ queryKey: ['task-tags', taskId] })

            const previousTags = queryClient.getQueryData<Tag[]>(['task-tags', taskId])
            const allTags = queryClient.getQueryData<Tag[]>(['tags'])

            // Optimistic update
            if (previousTags) {
                if (isAttached) {
                    // Remove
                    queryClient.setQueryData<Tag[]>(['task-tags', taskId], old =>
                        old?.filter(t => t.id !== tagId) || []
                    )
                } else {
                    // Add
                    const tagToAdd = allTags?.find(t => t.id === tagId)
                    if (tagToAdd) {
                        queryClient.setQueryData<Tag[]>(['task-tags', taskId], old =>
                            old ? [...old, tagToAdd] : [tagToAdd]
                        )
                    }
                }
            }

            return { previousTags }
        },
        onError: (_err, { taskId }, context) => {
            if (context?.previousTags) {
                queryClient.setQueryData(['task-tags', taskId], context.previousTags)
            }
        },
        onSettled: (_data, _error, { taskId }) => {
            queryClient.invalidateQueries({ queryKey: ['task-tags', taskId] })
            // We might also want to invalidate main task lists if we show tags there (though we fetch them differently there probably)
            queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
        }
    })
}
