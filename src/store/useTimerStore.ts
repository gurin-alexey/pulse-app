import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type TimerStatus = 'idle' | 'running' | 'paused'

interface TimerStore {
    taskId: string | null
    status: TimerStatus
    timeLeft: number        // seconds remaining
    duration: number        // total duration of the current session
    lastTick: number | null // timestamp of the last tick

    start: (taskId: string, duration?: number) => void
    pause: () => void
    resume: () => void
    stop: () => void
    tick: () => void
    setDuration: (seconds: number) => void
}

export const useTimerStore = create<TimerStore>()(
    persist(
        (set, get) => ({
            taskId: null,
            status: 'idle',
            timeLeft: 25 * 60,
            duration: 25 * 60,
            lastTick: null,

            start: (taskId, duration = 25 * 60) => set({
                taskId,
                status: 'running',
                timeLeft: duration,
                duration,
                lastTick: Date.now()
            }),

            pause: () => set({
                status: 'paused',
                lastTick: null
            }),

            resume: () => set({
                status: 'running',
                lastTick: Date.now()
            }),

            stop: () => set({
                taskId: null,
                status: 'idle',
                timeLeft: 25 * 60,
                lastTick: null
            }),

            setDuration: (seconds) => set((state) => ({
                duration: seconds,
                timeLeft: state.status === 'idle' ? seconds : state.timeLeft
            })),

            tick: () => {
                const { status, lastTick, timeLeft } = get()
                if (status !== 'running' || !lastTick) return

                const now = Date.now()
                // delta in seconds
                const delta = Math.floor((now - lastTick) / 1000)

                if (delta >= 1) {
                    const newTimeLeft = Math.max(0, timeLeft - delta)
                    set({
                        timeLeft: newTimeLeft,
                        lastTick: now, // advance lastTick
                        status: newTimeLeft === 0 ? 'idle' : 'running'
                    })

                    if (newTimeLeft === 0) {
                        // Optional: Trigger notification here or callback
                        // For now just stop.
                        const audio = new Audio('/notification.mp3') // Placeholder if we had one
                        // But we can reset taskId
                        set({ taskId: null, status: 'idle', timeLeft: get().duration })
                    }
                }
            }
        }),
        { name: 'pomodoro-storage' }
    )
)
