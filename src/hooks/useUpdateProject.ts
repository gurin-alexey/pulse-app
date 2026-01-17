import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/database'

export function useUpdateProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ projectId, updates }: { projectId: string, updates: Partial<Project> }) => {
            const { data, error } = await supabase
                .from('projects')
                .update(updates)
                .eq('id', projectId)
                .select()
                .single()

            if (error) throw error
            return data as Project
        },
        onMutate: async ({ projectId, updates }) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['projects'] })

            // Snapshot the previous value
            const previousProjects = queryClient.getQueryData<Project[]>(['projects'])

            // Optimistically update to the new value
            queryClient.setQueryData<Project[]>(['projects'], (old) => {
                if (!old) return []
                return old.map((project) =>
                    project.id === projectId ? { ...project, ...updates } : project
                )
            })

            // Return a context object with the snapshotted value
            return { previousProjects }
        },
        onError: (err, newProject, context) => {
            console.error('Update project failed:', err)
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousProjects) {
                queryClient.setQueryData<Project[]>(['projects'], context.previousProjects)
            }
        },
        onSettled: () => {
            // Always refetch after error or success:
            queryClient.invalidateQueries({ queryKey: ['projects'] })
        }
    })
}
