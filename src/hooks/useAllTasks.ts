import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, Tag } from '@/types/database'

export interface TaskOccurrence {
    id: string
    task_id: string
    original_date: string
    status: 'completed' | 'skipped' | 'archived'
}

export type TaskWithTags = Task & {
    tags: Tag[]
    subtasks_count?: number
}

export async function fetchAllTasks() {
    const [tasksResponse, occurrencesResponse] = await Promise.all([
        supabase
            .from('tasks')
            .select('*, task_tags(tags(*)), subtasks:tasks!parent_id(count)')
            .is('deleted_at', null)
            .order('due_date', { ascending: true }),
        supabase
            .from('task_occurrences')
            .select('*')
    ])

    if (tasksResponse.error) throw tasksResponse.error
    if (occurrencesResponse.error) throw occurrencesResponse.error

    const rawTasks = tasksResponse.data as any[]
    const occurrences = occurrencesResponse.data as TaskOccurrence[]

    // Map tasks to include tags array and subtasks_count
    const tasks = rawTasks.map(task => ({
        ...task,
        tags: task.task_tags?.map((tt: any) => tt.tags).filter((t: any) => t) || [],
        subtasks_count: task.subtasks?.[0]?.count || 0
    })) as TaskWithTags[]

    // Create a quick lookup map: "taskId_date" -> status
    const occurrencesMap: Record<string, string> = {}
    occurrences.forEach(occ => {
        occurrencesMap[`${occ.task_id}_${occ.original_date.split('T')[0]}`] = occ.status
    })

    return { tasks, occurrencesMap }
}

export function useAllTasks() {
    return useQuery({
        queryKey: ['all-tasks-v2'],
        queryFn: fetchAllTasks,
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 5, // 5 minutes fresh data
    })
}
