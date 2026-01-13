import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCreateTask } from '@/hooks/useCreateTask'
import { Plus, Mic, ArrowDown } from 'lucide-react'
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

    const [timerKey, setTimerKey] = useState(0)
    const [showTimer, setShowTimer] = useState(false)

    // Voice Input Logic
    const { isListening, startListening, stopListening, hasSupport } = useSpeechToText({ interimResults: true })

    const submitTaskFromRef = async () => {
        const taskTitle = titleRef.current
        if (!taskTitle.trim()) return

        setShowTimer(false) // Hide timer on submit

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

            // Reset and start visual timer
            setTimerKey(prev => prev + 1)
            setShowTimer(true)

            // Auto-submit after 2s
            submitTimerRef.current = setTimeout(() => {
                stopListening()
                submitTaskFromRef()
            }, 2000)
        } else {
            // Processing interim results - hide timer until silence/final
            setShowTimer(false)
        }
    }

    const onVoiceToggle = () => {
        if (isListening) {
            // Manual submit
            if (submitTimerRef.current) clearTimeout(submitTimerRef.current)
            stopListening()
            submitTaskFromRef()
        } else {
            setTitle('')
            startListening(handleVoiceCallback)
        }
    }

    const createUserTask = async (taskTitle: string) => {
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
        await createUserTask(title)
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
                    await createUserTask(line)
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
                            "absolute right-2 p-1.5 rounded-full transition-colors z-10 hover:bg-gray-100 flex items-center justify-center",
                            isListening ? "text-white bg-blue-500 hover:bg-blue-600" : "text-gray-400 hover:text-gray-600"
                        )}
                        title={isListening ? "Send" : "Dictate"}
                    >
                        {isListening ? (
                            <div className="relative flex items-center justify-center">
                                {/* SVG Timer Ring */}
                                {showTimer && (
                                    <svg className="absolute -top-[5px] -left-[5px] w-[26px] h-[26px] pointer-events-none rotate-[-90deg]">
                                        <circle
                                            cx="13"
                                            cy="13"
                                            r="11"
                                            fill="none"
                                            stroke="white"
                                            strokeWidth="3"
                                            strokeOpacity="0.3"
                                        />
                                        <CountdownCircle key={timerKey} duration={2000} />
                                    </svg>
                                )}
                                <ArrowDown size={16} strokeWidth={3} />
                            </div>
                        ) : (
                            <Mic size={16} />
                        )}
                    </button>
                )}
            </div>
        </form>
    )
}

function CountdownCircle({ duration, key }: { duration: number, key: number }) {
    const [active, setActive] = useState(false)

    useEffect(() => {
        setActive(false)
        const raf = requestAnimationFrame(() => setActive(true))
        return () => cancelAnimationFrame(raf)
    }, [key])

    return (
        <circle
            cx="13"
            cy="13"
            r="11"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="70"
            strokeDashoffset={active ? "0" : "70"}
            className="transition-all ease-linear"
            style={{ transitionDuration: `${duration}ms` }}
        />
    )
}
