import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

export interface TaskOccurrence {
    id: string
    task_id: string
    original_date: string
    status: 'completed' | 'skipped' | 'archived'
}

export async function fetchAllTasks() {
    const [tasksResponse, occurrencesResponse] = await Promise.all([
        supabase
            .from('tasks')
            .select('*, task_tags(tag_id)')
            .is('deleted_at', null)
            .order('due_date', { ascending: true }),
        supabase
            .from('task_occurrences')
            .select('*')
    ])

    if (tasksResponse.error) throw tasksResponse.error
    if (occurrencesResponse.error) throw occurrencesResponse.error

    const tasks = tasksResponse.data as Task[]
    const occurrences = occurrencesResponse.data as TaskOccurrence[]

    // Create a quick lookup map: "taskId_date" -> status
    // Use plain object for better serialization in React Query cache
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
        // Since we changed the return type, components consuming this need to handle the object structure.
        // Or we can keep returning tasks array but attach occurrences to them? 
        // No, separation is better. We will update components.
    })
}
