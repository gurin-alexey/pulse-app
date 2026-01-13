import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useTasksRealtime() {
    const queryClient = useQueryClient()
    const { user } = useAuth()

    useEffect(() => {
        if (!user) return

        // Create a channel for realtime updates specifically for this user's tasks
        const channel = supabase
            .channel('public:tasks')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'tasks',
                    filter: `user_id=eq.${user.id}`, // Filter by user to avoid getting everyone's updates (if RLS policies allow reading others)
                },
                (payload) => {
                    console.log('Realtime change received:', payload)

                    // Invalidate queries to trigger a refetch
                    // This is the "Smart Refetch" strategy
                    queryClient.invalidateQueries({ queryKey: ['tasks'] })
                    queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [queryClient, user])
}
