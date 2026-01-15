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
            queryClient.invalidateQueries({ queryKey: ['all-tasks-v2'] })
        }
    })

    const deleteForever = useMutation({
        mutationFn: async (taskId: string) => {
            // 1. Unlink subtasks (good practice)
            await supabase.from('tasks').update({ parent_id: null }).eq('parent_id', taskId)

            // 2. Clear relationships (Restore manual delete for these, as they likely lack CASCADE)
            await Promise.all([
                supabase.from('task_occurrences').delete().eq('task_id', taskId),
                supabase.from('task_tags').delete().eq('task_id', taskId)
            ])

            // 3. Delete task (Cascade will handle history)
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
            // 1. Unlink tasks (both project and section) to free them
            await supabase.from('tasks')
                .update({ project_id: null, section_id: null })
                .eq('project_id', projectId)

            // 2. Delete sections (manually to be safe against FKs)
            await supabase.from('sections').delete().eq('project_id', projectId)

            // 3. Delete Project
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
            // 1. Get IDs of Deleted Tasks
            const { data: deletedTasks } = await supabase
                .from('tasks')
                .select('id')
                .not('deleted_at', 'is', null)

            if (deletedTasks && deletedTasks.length > 0) {
                const ids = deletedTasks.map(t => t.id)

                // 2. Unlink subtasks 
                await supabase.from('tasks').update({ parent_id: null }).in('parent_id', ids)

                // 3. Clear relationships (Restore manual delete)
                await Promise.all([
                    supabase.from('task_occurrences').delete().in('task_id', ids),
                    supabase.from('task_tags').delete().in('task_id', ids)
                ])
            }

            // 4. Empty tasks (Cascade handles history)
            const { error: tasksError } = await supabase
                .from('tasks')
                .delete()
                .not('deleted_at', 'is', null)

            // 3. Empty projects
            const { data: deletedProjects } = await supabase
                .from('projects')
                .select('id')
                .not('deleted_at', 'is', null)

            if (deletedProjects && deletedProjects.length > 0) {
                const pIds = deletedProjects.map(p => p.id)

                // Unlink tasks
                await supabase.from('tasks')
                    .update({ project_id: null, section_id: null })
                    .in('project_id', pIds)

                // Delete sections
                await supabase.from('sections').delete().in('project_id', pIds)

                // Delete projects
                const { error: projectsError } = await supabase
                    .from('projects')
                    .delete()
                    .in('id', pIds)

                if (projectsError) throw projectsError
            }
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
