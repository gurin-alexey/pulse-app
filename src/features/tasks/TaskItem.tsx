import TextareaAutosize from 'react-textarea-autosize'
import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { CheckSquare, Square, GripVertical, Calendar, ChevronRight } from "lucide-react"
import { useTags, useToggleTaskTag, useTaskTags } from '@/hooks/useTags'
import clsx from "clsx"
import { motion } from "framer-motion"
import { addDays, nextMonday, format, startOfToday, differenceInCalendarDays } from "date-fns"
import { toast } from "sonner"

interface TaskItemProps {
    task: any
    isActive: boolean
    depth?: number
    listeners?: any
    attributes?: any
    hasChildren?: boolean
    isCollapsed?: boolean
    onToggleCollapse?: () => void
    disableAnimation?: boolean
}

export function TaskItem({ task, isActive, depth = 0, listeners, attributes, hasChildren, isCollapsed, onToggleCollapse, disableAnimation }: TaskItemProps) {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: toggleTag } = useToggleTaskTag()

    // Local state for inline editing
    const [title, setTitle] = useState(task.title)
    const [isEditing, setIsEditing] = useState(false)

    // Sync title if task updates externally
    useEffect(() => {
        setTitle(task.title)
    }, [task.title])

    const handleTaskClick = (e: React.MouseEvent) => {
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
            (e.currentTarget as HTMLTextAreaElement).blur()
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
            updateTask({ taskId: task.id, updates: { due_date: dateStr } })
            toast.success(toastMessage, { duration: 1500 })
        }
    }

    // Helper for relative date
    const getRelativeDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const today = startOfToday()
        const diff = differenceInCalendarDays(date, today)

        if (diff === 0) return <span className="text-green-600 font-medium">Сегодня</span>
        if (diff === 1) return <span className="text-gray-500">Завтра</span>
        if (diff > 1) return <span className="text-gray-500">{diff} дн.</span>
        if (diff < 0) return <span className="text-red-500 font-medium">{diff} дн.</span> // Past
        return null
    }

    return (
        <motion.div
            initial={disableAnimation ? false : { opacity: 0, y: 5 }}
            animate={disableAnimation ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.1 }}
            className="group relative"
            style={{ marginLeft: `${depth * 24}px` }} // Indentation for hierarchy
        >
            <div
                onClick={handleTaskClick}
                className={clsx(
                    "flex items-center gap-2 px-2 h-9 rounded-md transition-colors w-full select-none box-border border border-transparent", // h-9 = 36px fixed height, added transparent border for sizing consistency
                    isActive ? "bg-blue-50/80 !border-blue-100" : "hover:bg-gray-100/60",
                    task.is_completed && "opacity-50"
                )}
            >
                {/* Drag Handle (Hidden by default, visible on hover) */}
                <div
                    {...listeners}
                    {...attributes}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-gray-600 cursor-move transition-opacity -ml-1"
                >
                    <GripVertical size={14} />
                </div>

                {/* Checkbox */}
                <button
                    onClick={toggleStatus}
                    className={clsx("transition-colors", task.is_completed ? "text-gray-400" : "text-gray-300 hover:text-gray-500")}
                >
                    {task.is_completed ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                {/* Title (Flex 1, Truncate) */}
                <div className="flex-1 min-w-0 flex items-center self-stretch">
                    <TextareaAutosize
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            setIsEditing(true)
                            setSearchParams({ task: task.id })
                        }}
                        onClick={(e) => e.stopPropagation()}
                        minRows={1}
                        className={clsx(
                            "w-full bg-transparent border-0 outline-none focus:ring-0 p-0 leading-tight resize-none",
                            "overflow-hidden whitespace-nowrap truncate text-sm block h-full content-center",
                            task.is_completed ? "text-gray-400 line-through" : "text-gray-700 font-medium"
                        )}
                        spellCheck={false}
                    />
                </div>

                {/* Right Side: Tags & Date */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* Tags (Dots) */}
                    <div className="flex items-center -space-x-1">
                        {task.tags?.map((tag: any) => (
                            <div key={tag.id} className="w-2 h-2 rounded-full ring-2 ring-white" style={{ backgroundColor: tag.color }} title={tag.name} />
                        ))}
                    </div>

                    {/* Compact Date */}
                    {task.due_date && (
                        <div
                            className="text-xs tabular-nums cursor-help"
                            title={format(new Date(task.due_date), 'dd MMM yyyy')}
                        >
                            {getRelativeDate(task.due_date)}
                        </div>
                    )}

                    {/* Chevron (Right Side) */}
                    <div
                        className={clsx(
                            "w-6 h-6 flex items-center justify-center cursor-pointer transition-transform hover:bg-gray-200 rounded shrink-0",
                            !hasChildren && "invisible pointer-events-none",
                            isCollapsed ? "" : "rotate-90"
                        )}
                        onClick={(e) => {
                            if (hasChildren && onToggleCollapse) {
                                e.stopPropagation()
                                onToggleCollapse()
                            }
                        }}
                    >
                        <ChevronRight size={16} className="text-gray-400" />
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
