import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TaskWithTags } from './useTasks'

export function useTask(taskId: string | null) {
    return useQuery({
        queryKey: ['task', taskId],
        queryFn: async () => {
            if (!taskId) return null

            const { data, error } = await supabase
                .from('tasks')
                .select('*, task_tags(tags(*))')
                .eq('id', taskId)
                .single()

            if (error) throw error

            const task = data as any
            const taskWithTags: TaskWithTags = {
                ...task,
                tags: task.task_tags?.map((tt: any) => tt.tags) || []
            }

            return taskWithTags
        },
        enabled: !!taskId
    })
}
