import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Section } from '@/types/database'

export function useSections(projectId: string | undefined) {
    return useQuery({
        queryKey: ['sections', projectId],
        queryFn: async () => {
            if (!projectId) return []
            const { data, error } = await supabase
                .from('sections')
                .select('*')
                .eq('project_id', projectId)
                .order('order_index', { ascending: true })
                .order('created_at', { ascending: true })

            if (error) throw error
            return data as Section[]
        },
        enabled: !!projectId
    })
}

export function useCreateSection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ projectId, name }: { projectId: string, name: string }) => {
            // Get current max order index to append to end
            const { data: maxOrderData } = await supabase
                .from('sections')
                .select('order_index')
                .eq('project_id', projectId)
                .order('order_index', { ascending: false })
                .limit(1)

            const nextOrder = (maxOrderData?.[0]?.order_index ?? -1) + 1

            const { data, error } = await supabase
                .from('sections')
                .insert([{ project_id: projectId, name, order_index: nextOrder }])
                .select()
                .single()

            if (error) throw error
            return data as Section
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['sections', variables.projectId] })
        }
    })
}

export function useDeleteSection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (sectionId: string) => {
            // Tasks on delete should be set null due to DB constraint on delete set null,
            // or handled manually. Creating migration with ON DELETE SET NULL is best practice.
            // Assuming migration handled it.

            const { error } = await supabase
                .from('sections')
                .delete()
                .eq('id', sectionId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sections'] })
            queryClient.invalidateQueries({ queryKey: ['all-tasks'] }) // Invalidate tasks as their section_id might change
            // Also invalidate specific project tasks? 'all-tasks' usually covers it if set up right, but let's be safe
            // It's hard to know project ID here without passing it.
            // Ideally we pass projectId to onSuccess or invalidate broad keys.
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
        }
    })
}

export function useUpdateSection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<Section> }) => {
            const { data, error } = await supabase
                .from('sections')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Section
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sections'] })
        }
    })
}
