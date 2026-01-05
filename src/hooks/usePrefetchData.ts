import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchTasks } from './useTasks'
import { fetchAllTasks } from './useAllTasks'
import { supabase } from '@/lib/supabase'

export function usePrefetchData() {
    const queryClient = useQueryClient()

    useEffect(() => {
        const prefetch = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // Prefetch Inbox
            queryClient.prefetchQuery({
                queryKey: ['tasks', { type: 'inbox', includeSubtasks: true }],
                queryFn: () => fetchTasks({ type: 'inbox', includeSubtasks: true }),
                staleTime: 5 * 60 * 1000 // 5 minutes
            })

            // Prefetch Today
            queryClient.prefetchQuery({
                queryKey: ['tasks', { type: 'today', includeSubtasks: true }],
                queryFn: () => fetchTasks({ type: 'today', includeSubtasks: true }),
                staleTime: 5 * 60 * 1000
            })

            // Prefetch Calendar (all-tasks)
            queryClient.prefetchQuery({
                queryKey: ['all-tasks'],
                queryFn: fetchAllTasks,
                staleTime: 5 * 60 * 1000
            })
        }

        prefetch()
    }, [queryClient])
}
