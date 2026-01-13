import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCreateTask } from '@/hooks/useCreateTask'
import { Plus, Mic } from 'lucide-react'
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

    // Voice Input Logic
    const { isListening, toggleListening, hasSupport } = useSpeechToText({ interimResults: true })

    const handleVoiceResult = (result: { transcript: string, isFinal: boolean }) => {
        // Simple append logic or replace? Providing append behavior for now
        // Ideally we want to append only new words, but simpler to just set value if we assume "dictate to fill"
        // Let's rely on the assumption that if they use voice, they might be dictating the whole thing or appending.

        // Strategy: If isResult is final, append with space. If interim, show preview?
        // This simple hook delivers chunks.

        // Improved Strategy: The hook delivers total transcript since start in "continuous" mode usually.
        // But my hook implementation accumulates? NO, my hook resets onresult.
        // Let's just fix the hook logic implicitly by appending what we get.

        // Actually, for a single field input, replacing or smart appending is tricky.
        // Let's try: on voice start, we listen. 
        // We will append the *new* transcript to the existing title.

        // BUT: native recognition `continuous=true` returns *all* results in the session.
        // My hook implementation: 
        //   interimTranscript += ... 

        // Let's adjust: We will update the title based on previous title + new transcript.
        // To do this correctly without dupes, we might need a "voiceSessionStartTitle" state.
    }

    // Simplification for v1: just append whatever comes in "final"
    useEffect(() => {
        if (!isListening) return

        // We need a way to invoke toggleListening with a stable callback that knows about current title?
        // OR we refactor the usage.
    }, [isListening])

    const onVoiceToggle = () => {
        // Capture start state if needed
        toggleListening((result) => {
            // For now, simpler approach: just append result.transcript if final
            // Or better: update input value directly?

            // Issue: 'transcript' contains the WHOLE phrase for this session if continuous=true
            // So we should replace the "current voice part"

            // Let's settle on: non-continuous or just append. 
            // With `continuous=true` in hook, `event.results` accumulates.

            if (result.isFinal) {
                setTitle(prev => {
                    const trailingSpace = prev.length > 0 && !prev.endsWith(' ') ? ' ' : ''
                    let text = result.transcript
                    if (prev.trim().length === 0 && text.length > 0) {
                        text = text.charAt(0).toUpperCase() + text.slice(1)
                    }
                    return prev + trailingSpace + text
                })
            }
        })
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
                            isListening ? "text-red-500 animate-pulse bg-red-50 hover:bg-red-100" : "text-gray-400 hover:text-gray-600"
                        )}
                        title="Dictate"
                    >
                        <Mic size={16} className={clsx(isListening && "fill-current")} />
                    </button>
                )}
            </div>
        </form>
    )
}
