import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ProjectGroup } from '@/types/database'

export function useProjectGroups() {
    return useQuery({
        queryKey: ['project-groups'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_groups')
                .select('*')
                .order('created_at', { ascending: true })

            if (error) throw error
            return data as ProjectGroup[]
        }
    })
}

export function useCreateProjectGroup() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ name, userId }: { name: string, userId: string }) => {
            const { data, error } = await supabase
                .from('project_groups')
                .insert([{ name, user_id: userId }])
                .select()
                .single()

            if (error) throw error
            return data as ProjectGroup
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-groups'] })
        }
    })
}

export function useDeleteProjectGroup() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (groupId: string) => {
            // First, set group_id to null for all projects in this group (move to 'Inbox')
            const { error: updateError } = await supabase
                .from('projects')
                .update({ group_id: null })
                .eq('group_id', groupId)

            if (updateError) throw updateError

            // Then delete the group
            const { error } = await supabase
                .from('project_groups')
                .delete()
                .eq('id', groupId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-groups'] })
            queryClient.invalidateQueries({ queryKey: ['projects'] })
        }
    })
}

export function useUpdateProjectGroup() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<ProjectGroup> }) => {
            const { data, error } = await supabase
                .from('project_groups')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as ProjectGroup
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-groups'] })
        }
    })
}
