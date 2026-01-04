import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/database'

type CreateProjectParams = {
    name: string
    userId: string
    groupId?: string
}

/**
 * Mutation hook to create a new project (list).
 * Automatically invalidates 'projects' query.
 */
export function useCreateProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ name, userId, groupId }: CreateProjectParams) => {
            const { data, error } = await supabase
                .from('projects')
                .insert([{
                    name,
                    user_id: userId,
                    group_id: groupId || null
                }])
                .select()
                .single()

            if (error) throw error
            return data as Project
        },
        onSuccess: async (data) => {
            const projectId = data.id
            // Auto-create default sections
            await supabase.from('sections').insert([
                { project_id: projectId, name: 'Future' },
                { project_id: projectId, name: 'Ideas' }
            ])

            queryClient.invalidateQueries({ queryKey: ['projects'] })
        },
    })
}
