import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/database'

type CreateProjectParams = {
    name: string
    userId: string
    parentId?: string
}

/**
 * Mutation hook to create a new project (list).
 * Automatically invalidates 'projects' query.
 */
export function useCreateProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ name, userId }: CreateProjectParams) => {
            // Note: parentId is unused for now as it's not in the base type definition
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    name,
                    user_id: userId
                })
                .select()
                .single()

            if (error) throw error
            return data as Project
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
        },
    })
}
