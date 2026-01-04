import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useCreateTask } from '@/hooks/useCreateTask'
import { Loader2, Plus } from 'lucide-react'

type CreateTaskInputProps = {
    projectId: string
}

export function CreateTaskInput({ projectId }: CreateTaskInputProps) {
    const [title, setTitle] = useState('')
    const { mutate, isPending } = useCreateTask()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            alert('User not logged in')
            return
        }

        mutate(
            { title: title.trim(), projectId, userId: user.id },
            {
                onSuccess: () => {
                    setTitle('')
                },
                onError: (error) => {
                    console.error('Failed to create task:', error)
                    alert('Failed to create task')
                }
            }
        )
    }

    return (
        <form onSubmit={handleSubmit} className="mb-4">
            <div className="relative flex items-center">
                <div className="absolute left-3 text-gray-400">
                    {isPending ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                </div>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="New task"
                    disabled={isPending}
                    className="w-full py-3 pl-10 pr-4 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-400"
                />
            </div>
        </form>
    )
}
