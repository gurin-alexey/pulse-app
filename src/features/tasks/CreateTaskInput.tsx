import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useCreateTask } from '@/hooks/useCreateTask'
import { Plus } from 'lucide-react'
import clsx from 'clsx'

type CreateTaskInputProps = {
    projectId: string | null
    sectionId?: string | null
    placeholder?: string
    defaultDueDate?: string | null
}

export function CreateTaskInput({ projectId, sectionId, placeholder = "New task", defaultDueDate }: CreateTaskInputProps) {
    const [title, setTitle] = useState('')
    const [isFocused, setIsFocused] = useState(false)
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
            { id: crypto.randomUUID(), title: taskTitle.trim(), projectId, userId: user.id, sectionId: sectionId, due_date: defaultDueDate },
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
        // Keep focus? Usually yes for rapid entry
        // But if user wants to collapse, they click away.
        // isFocused will handle style.
    }

    const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text')
        if (!text.includes('\n')) return

        e.preventDefault()

        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)

        if (lines.length > 1) {
            if (window.confirm(`Do you want to create ${lines.length} tasks from the pasted text?`)) {
                const linesToProcess = [...lines].reverse()

                for (const line of linesToProcess) {
                    await createTask(line)
                }
            } else {
                const singleLineText = lines.join(' ')
                insertTextAtCursor(singleLineText)
            }
        } else if (lines.length === 1) {
            insertTextAtCursor(lines[0])
        }
    }

    const insertTextAtCursor = (text: string) => {
        if (!inputRef.current) return

        const start = inputRef.current.selectionStart || 0
        const end = inputRef.current.selectionEnd || 0

        const newTitle = title.substring(0, start) + text + title.substring(end)
        setTitle(newTitle)

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.selectionStart = inputRef.current.selectionEnd = start + text.length
            }
        }, 0)
    }

    // New styles logic
    const isExpanded = isFocused || title.length > 0

    return (
        <form onSubmit={handleSubmit} className={clsx("transition-all duration-300", isExpanded ? "w-full" : "w-48 inline-block")}>
            <div className={clsx("relative flex items-center transition-all duration-300 rounded-lg overflow-hidden", isExpanded ? "w-full" : "w-48")}>
                <div className={clsx("absolute top-0 bottom-0 left-0 w-10 flex items-center justify-center transition-colors z-10 bg-blue-50 text-blue-600 border-r border-blue-100")}>
                    <Plus size={20} />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onPaste={handlePaste}
                    placeholder={placeholder}
                    className={clsx(
                        "w-full py-2.5 pl-12 pr-4 outline-none transition-all placeholder:font-medium text-sm",
                        isExpanded
                            ? "bg-white border border-blue-200 text-gray-900 shadow-sm ring-4 ring-blue-50/50 placeholder:text-gray-400 rounded-lg"
                            : "bg-gray-50 border border-transparent text-gray-600 hover:bg-white hover:shadow-sm hover:border-gray-200 cursor-text placeholder:text-gray-500 rounded-lg"
                    )}
                />
            </div>
        </form>
    )
}
