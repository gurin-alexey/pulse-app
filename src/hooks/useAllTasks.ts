import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

export async function fetchAllTasks() {
    const { data, error } = await supabase
        .from('tasks')
        .select('*, task_tags(tag_id)')
        .is('deleted_at', null)
        .order('due_date', { ascending: true })

    if (error) throw error
    return data as Task[]
}

export function useAllTasks() {
    return useQuery({
        queryKey: ['all-tasks'],
        queryFn: fetchAllTasks
    })
}
