import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, Tag } from '@/types/database'

type TaskWithTags = Task & {
    tags: Tag[]
}

export function useTagTasks(tagId: string | undefined) {
    return useQuery({
        queryKey: ['tag-tasks', tagId],
        queryFn: async () => {
            if (!tagId) return []

            // Fetch task IDs associated with this tag
            const { data: taskTagsData, error: taskTagsError } = await supabase
                .from('task_tags')
                .select('task_id')
                .eq('tag_id', tagId)

            if (taskTagsError) throw taskTagsError
            if (!taskTagsData || taskTagsData.length === 0) return []

            const taskIds = taskTagsData.map(tt => tt.task_id)

            // Fetch tasks details
            const { data: tasksData, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .in('id', taskIds)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })

            if (tasksError) throw tasksError

            // Fetch tags for these tasks to display them
            const { data: allTaskTags, error: allTagsError } = await supabase
                .from('task_tags')
                .select('task_id, tags(*)')
                .in('task_id', taskIds)

            if (allTagsError) throw allTagsError

            // Map tags to tasks
            const tasksWithTags = tasksData.map(task => {
                const tags = allTaskTags
                    .filter(t => t.task_id === task.id)
                    .map(t => t.tags) as unknown as Tag[]
                return { ...task, tags }
            })

            return tasksWithTags as TaskWithTags[]
        },
        enabled: !!tagId
    })
}
