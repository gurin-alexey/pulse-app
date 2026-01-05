import { useEffect } from 'react'
import { addDays, nextMonday, format, startOfToday } from 'date-fns'
import { toast } from 'sonner'
import { useUpdateTask } from './useUpdateTask'

export function useTaskDateHotkeys(taskId: string, enabled: boolean = true) {
    const { mutate: updateTask } = useUpdateTask()

    useEffect(() => {
        if (!enabled || !taskId) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented) return

            // Hotkeys: Alt + 1, 2, 3, 0
            if (e.altKey) {
                let newDate: Date | null = null
                let toastMessage = ""

                // Prevent capturing if modifier keys other than Alt are pressed (e.g. Ctrl+Alt often global system shortcuts)
                // But specifically we want Alt+Key

                switch (e.key) {
                    case '1': // Today
                        newDate = startOfToday()
                        toastMessage = "📅 Set to Today"
                        break
                    case '2': // Tomorrow
                        newDate = addDays(startOfToday(), 1)
                        toastMessage = "📅 Set to Tomorrow"
                        break
                    case '3': // Next Week
                        newDate = nextMonday(startOfToday())
                        toastMessage = "📅 Set to Next Week"
                        break
                    case '0': // Clear
                        newDate = null
                        toastMessage = "📅 Date Cleared"
                        break
                    default:
                        return
                }

                e.preventDefault()
                e.stopPropagation() // Stop bubbling

                const dateStr = newDate ? format(newDate, 'yyyy-MM-dd') : null

                updateTask({
                    taskId,
                    updates: { due_date: dateStr }
                })

                toast.success(toastMessage, { duration: 1500, id: 'date-update' }) // use ID to prevent duplicate toasts
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [taskId, enabled, updateTask])
}
