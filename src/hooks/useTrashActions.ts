import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useTrashActions() {
    const queryClient = useQueryClient()

    const restoreTask = useMutation({
        mutationFn: async (taskId: string) => {
            const { error } = await supabase
                .from('tasks')
                .update({ deleted_at: null })
                .eq('id', taskId)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
        }
    })

    const deleteForever = useMutation({
        mutationFn: async (taskId: string) => {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
        }
    })

    const restoreProject = useMutation({
        mutationFn: async (projectId: string) => {
            const { error } = await supabase
                .from('projects')
                .update({ deleted_at: null })
                .eq('id', projectId)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
        }
    })

    const deleteProjectForever = useMutation({
        mutationFn: async (projectId: string) => {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
        }
    })

    const emptyTrash = useMutation({
        mutationFn: async () => {
            // Empty tasks
            const { error: tasksError } = await supabase
                .from('tasks')
                .delete()
                .not('deleted_at', 'is', null)

            // Empty projects
            const { error: projectsError } = await supabase
                .from('projects')
                .delete()
                .not('deleted_at', 'is', null)

            if (tasksError) throw tasksError
            if (projectsError) throw projectsError
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['projects'] })
        }
    })

    return {
        restoreTask,
        deleteForever,
        restoreProject,
        deleteProjectForever,
        emptyTrash
    }
}
