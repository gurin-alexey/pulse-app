import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tag } from '@/types/database'
import { CATEGORIES } from '../constants'

export const useTagMutations = () => {
    const queryClient = useQueryClient()

    const createTag = useMutation({
        mutationFn: async ({ name, category, color: forcedColor, parent_id }: { name: string, category?: string, color?: string, parent_id?: string }) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("User not authenticated")

            // Simple random color generator if not provided
            const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e']
            const color = forcedColor || colors[Math.floor(Math.random() * colors.length)]

            const { data, error } = await supabase
                .from('tags')
                .insert({
                    name,
                    user_id: user.id,
                    color,
                    category,
                    parent_id
                })
                .select()
                .single()

            if (error) throw error
            return data as Tag
        },
        onMutate: async (newTag) => {
            await queryClient.cancelQueries({ queryKey: ['tags'] })
            const previousTags = queryClient.getQueryData<Tag[]>(['tags'])

            // Optimistic update
            if (previousTags) {
                const optimisticTag: Tag = {
                    id: crypto.randomUUID(), // temp ID
                    name: newTag.name,
                    color: newTag.color || '#ccc',
                    category: newTag.category as any,
                    parent_id: newTag.parent_id || null,
                    user_id: 'temp',
                    created_at: new Date().toISOString()
                }
                queryClient.setQueryData<Tag[]>(['tags'], (old) => {
                    return old ? [...old, optimisticTag].sort((a, b) => a.name.localeCompare(b.name)) : [optimisticTag]
                })
            }

            return { previousTags }
        },
        onError: (_err, _newTag, context) => {
            if (context?.previousTags) {
                queryClient.setQueryData(['tags'], context.previousTags)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] })
        }
    })

    const updateTag = useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<Tag> }) => {
            const { data, error } = await supabase
                .from('tags')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Tag
        },
        onMutate: async ({ id, updates }) => {
            await queryClient.cancelQueries({ queryKey: ['tags'] })
            const previousTags = queryClient.getQueryData<Tag[]>(['tags'])

            // Optimistic update
            if (previousTags) {
                queryClient.setQueryData<Tag[]>(['tags'], (old) => {
                    return old?.map(t => t.id === id ? { ...t, ...updates } : t) || []
                })
            }

            return { previousTags }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousTags) {
                queryClient.setQueryData(['tags'], context.previousTags)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] })
        }
    })

    const deleteTag = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('tags')
                .delete()
                .eq('id', id)

            if (error) throw error
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['tags'] })
            const previousTags = queryClient.getQueryData<Tag[]>(['tags'])

            // Optimistic update
            if (previousTags) {
                queryClient.setQueryData<Tag[]>(['tags'], (old) => {
                    return old?.filter(t => t.id !== id) || []
                })
            }

            return { previousTags }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousTags) {
                queryClient.setQueryData(['tags'], context.previousTags)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] })
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
            queryClient.invalidateQueries({ queryKey: ['task-tags'] })
        }
    })

    const toggleTaskTag = useMutation({
        mutationFn: async ({ taskId, tagId, isAttached }: { taskId: string, tagId: string, isAttached: boolean }) => {
            if (isAttached) {
                // Delete association
                const { error } = await supabase
                    .from('task_tags')
                    .delete()
                    .eq('task_id', taskId)
                    .eq('tag_id', tagId)
                if (error) throw error
                return { action: 'removed', tagId }
            } else {
                // Create association
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
                    queryClient.setQueryData<Tag[]>(['task-tags', taskId], (old) =>
                        old?.filter(t => t.id !== tagId) || []
                    )
                } else {
                    // Add
                    const tagToAdd = allTags?.find(t => t.id === tagId)
                    if (tagToAdd) {
                        queryClient.setQueryData<Tag[]>(['task-tags', taskId], (old) =>
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
            // We invalidate tasks to refresh the list view if tags are shown there
            queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            // Invalidate the specific task detail query to update the UI in TaskDetail
            queryClient.invalidateQueries({ queryKey: ['task', taskId] })
        }
    })

    return {
        createTag,
        updateTag,
        deleteTag,
        toggleTaskTag
    }
}
