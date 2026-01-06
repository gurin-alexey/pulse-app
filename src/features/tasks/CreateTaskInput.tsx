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

    const createTask = async (taskTitle: string) => {
        if (!taskTitle.trim()) return

        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            alert('User not logged in')
            return
        }

        mutate(
            { id: crypto.randomUUID(), title: taskTitle.trim(), projectId, userId: user.id, sectionId: sectionId },
            {
                onError: (error) => {
                    console.error('Failed to create task:', error)
                    alert(`Failed to create task: ${error.message}`)
                }
            }
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await createTask(title)
        setTitle('')
        inputRef.current?.focus()
    }

    const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text')
        if (!text.includes('\n')) return

        e.preventDefault()

        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)

        if (lines.length > 1) {
            if (window.confirm(`Do you want to create ${lines.length} tasks from the pasted text?`)) {

                // Batch create
                // Reverse lines so the FIRST line in text becomes the LAST created task (Newest),
                // so it appears at the TOP of the list (which is sorted by Newest First).
                const linesToProcess = [...lines].reverse()

                for (const line of linesToProcess) {
                    await createTask(line)
                }

                // We don't clear title here because we prevented default paste, 
                // and the input might have had existing text. 
                // Actually, if we just created tasks from the paste, we probably 
                // don't want to add the text to the input anymore.
                // But the user might have typed "Important: " and then pasted.
                // If we create tasks, we "consumed" the pasted text. 
                // The existing text in input remains? 
                // If I am typing "Some prefix " and paste 5 lines.
                // If I say "Yes" -> 5 tasks created. What happens to "Some prefix "?
                // Standard expectation: The pasted content became tasks. The input stays as is? 
                // Or maybe the input should be cleared? 
                // Let's assume the user purely wanted to paste tasks. 
                // But if they had partial text, it's ambiguous.
                // For now, let's just create the tasks from *pasted* text and leave the input field alone (preserving whatever was there).

            } else {
                // User said NO, treat as single task (replace newlines with spaces)
                const singleLineText = lines.join(' ')
                insertTextAtCursor(singleLineText)
            }
        } else if (lines.length === 1) {
            // Just one line effectively (maybe just a trailing newline), treat normally
            insertTextAtCursor(lines[0])
        }
    }

    const insertTextAtCursor = (text: string) => {
        if (!inputRef.current) return

        const start = inputRef.current.selectionStart || 0
        const end = inputRef.current.selectionEnd || 0

        const newTitle = title.substring(0, start) + text + title.substring(end)
        setTitle(newTitle)

        // Restore cursor position
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.selectionStart = inputRef.current.selectionEnd = start + text.length
            }
        }, 0)
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
                    onPaste={handlePaste}
                    placeholder={placeholder}
                    className="w-full py-3 pl-10 pr-4 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-400"
                />
            </div>
        </form>
    )
}
