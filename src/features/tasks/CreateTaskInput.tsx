import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useCreateTask } from '@/hooks/useCreateTask'
import { Plus } from 'lucide-react'

type CreateTaskInputProps = {
    projectId: string | null
    sectionId?: string | null
    placeholder?: string
}

export function CreateTaskInput({ projectId, sectionId, placeholder = "New task" }: CreateTaskInputProps) {
    const [title, setTitle] = useState('')
    const { mutate, isPending } = useCreateTask()
    const inputRef = useRef<HTMLInputElement>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        const newTitle = title.trim()
        setTitle('') // Clear immediately for speed
        inputRef.current?.focus() // Ensure focus stays

        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            setTitle(newTitle) // Restore
            alert('User not logged in')
            return
        }

        mutate(
            { id: crypto.randomUUID(), title: newTitle, projectId, userId: user.id, sectionId: sectionId },
            {
                onError: (error) => {
                    console.error('Failed to create task:', error)
                    setTitle(newTitle) // Restore
                    alert(`Failed to create task: ${error.message}`)
                }
            }
        )
    }

    return (
        <form onSubmit={handleSubmit} className="mb-4">
            <div className="relative flex items-center">
                <div className="absolute left-3 text-gray-400">
                    <Plus size={20} />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={placeholder}
                    className="w-full py-3 pl-10 pr-4 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-400"
                />
            </div>
        </form>
    )
}
