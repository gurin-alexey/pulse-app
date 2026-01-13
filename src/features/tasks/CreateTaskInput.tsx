import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCreateTask } from '@/hooks/useCreateTask'
import { Plus, Mic, ArrowUp } from 'lucide-react'
import clsx from 'clsx'
import { useSpeechToText } from '@/hooks/useSpeechToText'

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

    // State refs to avoid stale closures in callbacks
    const titleRef = useRef(title)
    useEffect(() => { titleRef.current = title }, [title])

    const propsRef = useRef({ projectId, sectionId, defaultDueDate })
    useEffect(() => {
        propsRef.current = { projectId, sectionId, defaultDueDate }
    }, [projectId, sectionId, defaultDueDate])

    const submitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    // Voice Input Logic
    const { isListening, startListening, stopListening, hasSupport } = useSpeechToText({ interimResults: true })

    const submitTaskFromRef = async () => {
        const taskTitle = titleRef.current
        if (!taskTitle.trim()) return

        const { projectId, sectionId, defaultDueDate } = propsRef.current
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
        setTitle('')
    }

    const handleVoiceCallback = (result: { transcript: string, isFinal: boolean }) => {
        if (submitTimerRef.current) clearTimeout(submitTimerRef.current)

        if (result.isFinal) {
            setTitle(prev => {
                const trailingSpace = prev.length > 0 && !prev.endsWith(' ') ? ' ' : ''
                let text = result.transcript
                if (prev.trim().length === 0 && text.length > 0) {
                    text = text.charAt(0).toUpperCase() + text.slice(1)
                }
                return prev + trailingSpace + text
            })

            // Auto-submit after 2.5s of silence (after final result)
            submitTimerRef.current = setTimeout(() => {
                stopListening()
                submitTaskFromRef()
            }, 2500)
        }
    }

    const onVoiceToggle = () => {
        if (isListening) {
            // Manual submit
            if (submitTimerRef.current) clearTimeout(submitTimerRef.current)
            stopListening()
            submitTaskFromRef()
        } else {
            setTitle('') // Optional: Clear title on new dictation? Or append? User implies "dictate message", usually fresh.
            // But existing code allowed appending. I'll keep appending logic in callback, but NOT clear here.
            startListening(handleVoiceCallback)
        }
    }

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

    // Always expanded style
    return (
        <form onSubmit={handleSubmit} className="w-full transition-all duration-300">
            <div className="relative flex items-center w-full rounded-lg overflow-hidden">
                <div className="absolute top-0 bottom-0 left-0 w-10 flex items-center justify-center transition-colors z-10 bg-blue-50 text-blue-600 border-r border-blue-100">
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
                    placeholder={isListening ? "Listening..." : placeholder}
                    className="w-full py-2.5 pl-12 pr-10 outline-none transition-all placeholder:font-medium text-sm bg-white border border-blue-200 text-gray-900 shadow-sm ring-4 ring-blue-50/50 placeholder:text-gray-400 rounded-lg"
                />

                {/* Mic Button */}
                {hasSupport && (
                    <button
                        type="button"
                        onClick={onVoiceToggle}
                        className={clsx(
                            "absolute right-2 p-1.5 rounded-full transition-colors z-10 hover:bg-gray-100",
                            isListening ? "text-white bg-blue-500 hover:bg-blue-600 animate-pulse" : "text-gray-400 hover:text-gray-600"
                        )}
                        title={isListening ? "Send" : "Dictate"}
                    >
                        {isListening ? (
                            <ArrowUp size={16} strokeWidth={3} />
                        ) : (
                            <Mic size={16} />
                        )}
                    </button>
                )}
            </div>
        </form>
    )
}
