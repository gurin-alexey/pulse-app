import TextareaAutosize from 'react-textarea-autosize'
import { useState, useRef, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { CheckSquare, Square, GripVertical, Calendar } from "lucide-react"
import { useTags, useToggleTaskTag, useTaskTags } from '@/hooks/useTags'
import clsx from "clsx"
import { motion } from "framer-motion"
import { addDays, nextMonday, format, startOfToday } from "date-fns"
import { toast } from "sonner"

interface TaskItemProps {
    task: any
    isActive: boolean
    depth?: number
    listeners?: any
    attributes?: any
}

export function TaskItem({ task, isActive, depth = 0, listeners, attributes }: TaskItemProps) {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { mutate: updateTask } = useUpdateTask()
    const { data: allTags } = useTags()
    const { data: taskTags } = useTaskTags(task.id)
    const { mutate: toggleTag } = useToggleTaskTag()

    // Local state for inline editing
    const [title, setTitle] = useState(task.title)
    const [isEditing, setIsEditing] = useState(false)

    // Sync title if task updates externally
    useEffect(() => {
        setTitle(task.title)
    }, [task.title])

    const handleTaskClick = (e: React.MouseEvent) => {
        // Don't open if editing or clicking checkboxes/tags
        if (isEditing) return
        setSearchParams({ task: task.id })
    }

    const toggleStatus = (e?: React.MouseEvent | React.TouchEvent) => {
        e?.stopPropagation()
        updateTask({ taskId: task.id, updates: { is_completed: !task.is_completed } })
    }

    const saveTitle = () => {
        if (title.trim() !== task.title) {
            updateTask({ taskId: task.id, updates: { title: title.trim() } })
        }
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLTextAreaElement).blur() // Triggers onBlur -> saveTitle
        }

        // Date Shortcuts: Alt + 1, 2, 3, 0
        if (e.altKey) {
            let newDate: Date | null = null
            let toastMessage = ""

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

            const dateStr = newDate ? format(newDate, 'yyyy-MM-dd') : null

            updateTask({
                taskId: task.id,
                updates: { due_date: dateStr }
            })

            toast.success(toastMessage, { duration: 1500 })
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="mb-2 relative"
            style={{ marginLeft: `${depth * 24}px` }}
        >
            <div
                onClick={handleTaskClick}
                className={clsx(
                    "flex items-start p-3 border rounded-lg transition-colors group bg-white w-full shadow-sm",
                    isActive ? "bg-blue-50 border-blue-200" : "border-gray-100 hover:bg-gray-50",
                    task.is_completed && "opacity-60"
                )}
            >
                {/* Drag Handle */}
                <div
                    {...listeners}
                    {...attributes}
                    className={clsx(
                        "mt-1 mr-2 p-1 -ml-2 touch-none transition-colors rounded hover:bg-black/5",
                        "cursor-move active:cursor-grabbing",
                        isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                    )}
                    onPointerDown={e => {
                        listeners?.onPointerDown?.(e)
                        e.stopPropagation()
                    }}
                >
                    <GripVertical size={18} />
                </div>

                {/* Checkbox */}
                <button
                    onClick={(e) => toggleStatus(e)}
                    className={clsx("mt-0.5 mr-3 transition-colors", task.is_completed ? "text-green-500" : "text-gray-300 hover:text-gray-500")}
                >
                    {task.is_completed ? <CheckSquare size={22} /> : <Square size={22} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-1">
                        <TextareaAutosize
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={saveTitle}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsEditing(true)}
                            onClick={(e) => e.stopPropagation()} // Prevent opening details when clicking to edit
                            minRows={1}
                            className={clsx(
                                "w-full resize-none bg-transparent border-none p-0 focus:ring-0 leading-tight",
                                "block overflow-hidden", // Important for TextareaAutosize
                                task.is_completed ? "text-gray-400 line-through" : "text-gray-700",
                                task.is_project ? "uppercase tracking-wide font-bold text-sm" : "font-medium"
                            )}
                        />

                        <div className="flex items-center gap-2 min-h-[16px]">
                            {/* Tags */}
                            <div className="flex items-center gap-1">
                                {task.tags?.map((tag: any) => (
                                    <div key={tag.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} title={tag.name} />
                                ))}
                            </div>

                            {/* Meta Info */}
                            <div className="flex items-center gap-3 text-xs">
                                {task.due_date && (
                                    <div
                                        className="flex items-center gap-1 cursor-help"
                                        title="Tip: Alt+1 (Today), Alt+2 (Tomorrow), Alt+3 (Next Week)"
                                    >
                                        <Calendar size={12} className={clsx(
                                            new Date(task.due_date) < new Date() && !task.is_completed ? "text-red-500" : "text-gray-400"
                                        )} />
                                        <span className={clsx(
                                            new Date(task.due_date) < new Date() && !task.is_completed ? "text-red-500 font-medium" : "text-gray-400"
                                        )}>
                                            {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                )}
                                {task.start_time && (
                                    <span className="text-gray-400">
                                        {new Date(task.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Details Button (Chevron) */}
                <div className="ml-2 text-gray-300 group-hover:text-blue-500 transition-colors cursor-pointer">
                    {/* We can use something visual here or just let the whole row be clickable (except textarea) */}
                </div>
            </div>
        </motion.div>
    )
}
