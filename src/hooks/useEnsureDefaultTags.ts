import { useEffect, useRef } from 'react'
import { useTags, useCreateTag } from '@/hooks/useTags'

export function useEnsureDefaultTags() {
    const { data: tags, isLoading } = useTags()
    const { mutate: createTag } = useCreateTag()
    const attemptedRef = useRef(false)

    useEffect(() => {
        if (isLoading || !tags || attemptedRef.current) return

        const hasPomo = tags.some(t => t.name.toLowerCase() === 'pomo' || t.name.toLowerCase() === 'pomodoro')

        if (!hasPomo) {
            const seedAttempted = localStorage.getItem('pulse.pomoSeedAttempted')
            if (!seedAttempted) {
                console.log("Seeding default Pomo tag...")
                createTag({ name: 'Pomo', category: 'time', color: '#ef4444' })
                localStorage.setItem('pulse.pomoSeedAttempted', 'true')
            }
        }
        attemptedRef.current = true
    }, [tags, isLoading, createTag])
}
