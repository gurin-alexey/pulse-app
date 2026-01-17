import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

type TimerStatus = 'idle' | 'running' | 'paused'

interface TimerStore {
    taskId: string | null
    status: TimerStatus
    timeLeft: number        // seconds remaining
    duration: number        // total duration of the current session
    lastTick: number | null // timestamp of the last tick
    sessionStart: number | null // when the session logically started (for tracking)

    start: (taskId: string, duration?: number) => void
    pause: () => void
    resume: () => void
    stop: () => void // Manually stop and save logic
    tick: () => void
    setDuration: (seconds: number) => void
}

const saveSession = async (taskId: string, durationSeconds: number, completed: boolean) => {
    if (durationSeconds < 10) return // Don't save if less than 10 seconds

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('pomodoro_sessions').insert({
        task_id: taskId,
        user_id: user.id,
        duration_seconds: durationSeconds,
        completed: completed,
        started_at: new Date(Date.now() - durationSeconds * 1000).toISOString(),
        ended_at: new Date().toISOString()
    })
}

export const useTimerStore = create<TimerStore>()(
    persist(
        (set, get) => ({
            taskId: null,
            status: 'idle',
            timeLeft: 25 * 60,
            duration: 25 * 60,
            lastTick: null,
            sessionStart: null,

            start: (taskId, duration = 25 * 60) => set({
                taskId,
                status: 'running',
                timeLeft: duration,
                duration,
                lastTick: Date.now(),
                sessionStart: Date.now()
            }),

            pause: () => set({
                status: 'paused',
                lastTick: null
            }),

            resume: () => set({
                status: 'running',
                lastTick: Date.now()
            }),

            stop: () => {
                const { taskId, duration, timeLeft } = get()
                if (taskId) {
                    const elapsed = duration - timeLeft
                    saveSession(taskId, elapsed, false)
                }

                set({
                    taskId: null,
                    status: 'idle',
                    timeLeft: 25 * 60,
                    lastTick: null,
                    sessionStart: null
                })
            },

            setDuration: (seconds) => set((state) => ({
                duration: seconds,
                timeLeft: state.status === 'idle' ? seconds : state.timeLeft
            })),

            tick: () => {
                const { status, lastTick, timeLeft, duration, taskId } = get()
                if (status !== 'running' || !lastTick) return

                const now = Date.now()
                // delta in seconds
                const delta = Math.floor((now - lastTick) / 1000)

                if (delta >= 1) {
                    const newTimeLeft = Math.max(0, timeLeft - delta)

                    if (newTimeLeft === 0) {
                        // Timer finished naturally
                        if (taskId) {
                            saveSession(taskId, duration, true)
                        }

                        // Play sound or notification if possible
                        // const audio = new Audio('/notification.mp3') // Placeholder

                        set({
                            taskId: null,
                            status: 'idle',
                            timeLeft: duration,
                            lastTick: null,
                            sessionStart: null
                        })
                    } else {
                        set({
                            timeLeft: newTimeLeft,
                            lastTick: now, // advance lastTick
                            status: 'running'
                        })
                    }
                }
            }
        }),
        { name: 'pomodoro-storage' }
    )
)
