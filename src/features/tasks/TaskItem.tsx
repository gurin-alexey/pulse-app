import TextareaAutosize from 'react-textarea-autosize'
import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { useDeleteTask } from "@/hooks/useDeleteTask"
import { CheckSquare, Square, GripVertical, Calendar, ChevronRight, Tag as TagIcon, Trash2, MoreHorizontal } from "lucide-react"
import { useTags, useToggleTaskTag } from '@/hooks/useTags'
import clsx from "clsx"
import { motion } from "framer-motion"
import { addDays, nextMonday, format, startOfToday, differenceInCalendarDays } from "date-fns"
import { toast } from "sonner"

import { useSelectionStore } from "@/store/useSelectionStore"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useSettings } from "@/store/useSettings"
import { useTrashActions } from "@/hooks/useTrashActions"
import { ContextMenu } from "@/shared/components/ContextMenu"
import { useSwipeable } from "react-swipeable"

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
    onIndent?: () => void
    onOutdent?: () => void
    onShiftClick?: (id: string) => void
}

export function TaskItem({ task, isActive, depth = 0, listeners, attributes, hasChildren, isCollapsed, onToggleCollapse, disableAnimation, onShiftClick, onIndent, onOutdent }: TaskItemProps) {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: deleteTask } = useDeleteTask()
    const { restoreTask } = useTrashActions()
    const { mutate: toggleTag } = useToggleTaskTag()
    const { data: allTags } = useTags()
    const { settings } = useSettings()

    const showToasts = settings?.preferences.show_toast_hints !== false

    const { selectedIds, select, toggle } = useSelectionStore()
    const isSelected = selectedIds.has(task.id)
    const isMobile = useMediaQuery("(max-width: 768px)")

    // Local state for inline editing
    const [title, setTitle] = useState(task.title)
    const [isEditing, setIsEditing] = useState(false)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)

    // Swipe Logic
    const swipeHandlers = useSwipeable({
        onSwipedRight: () => {
            if (isMobile && onIndent) onIndent()
        },
        onSwipedLeft: () => {
            if (isMobile && onOutdent) onOutdent()
        },
        trackMouse: false,
        trackTouch: true,
        preventScrollOnSwipe: false,
        delta: 30
    })

    // Sync title if task updates externally
    useEffect(() => {
        setTitle(task.title)
    }, [task.title])

    const handleTaskClick = (e: React.MouseEvent) => {
        if (isEditing) return

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            toggle(task.id)
            return
        }

        if (e.shiftKey && onShiftClick) {
            e.preventDefault()
            const selection = window.getSelection()
            if (selection) selection.removeAllRanges()
            onShiftClick(task.id)
            return
        }

        if (selectedIds.size > 1) {
            select(task.id)
        } else {
            if (!selectedIds.has(task.id)) select(task.id)
        }

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
            if (showToasts) toast.success(toastMessage, { duration: 1500 })
        }
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY })
    }

    const getRelativeDate = (dateStr: string) => {
        // 1. If it has time (Calendar event), show time instead of generic date
        if (task.start_time) {
            // Helper to format ISO time strings to HH:mm
            const formatTime = (isoString: string) => {
                if (!isoString) return ''
                if (isoString.includes('T')) {
                    const date = new Date(isoString)
                    const hours = date.getHours()
                    const minutes = date.getMinutes()
                    // Always render HH:mm
                    return `${hours}:${minutes.toString().padStart(2, '0')}`
                }
                // Fallback but ensure HH:mm pattern if it was already short
                return isoString
            }

            const timeStr = formatTime(task.start_time)
            return <span className="text-blue-600 font-medium text-xs bg-blue-50 px-1.5 py-0.5 rounded">{timeStr}</span>
        }

        const date = new Date(dateStr)
        const today = startOfToday()
        const diff = differenceInCalendarDays(date, today)

        // 2. Hide "Today" label as requested (it's redundant in Today view, and implied elsewhere)
        if (diff === 0) return null

        if (diff === 1) return <span className="text-gray-500">Завтра</span>
        if (diff > 1) return <span className="text-gray-500">{diff} дн.</span>
        if (diff < 0) return <span className="text-red-500 font-medium">{diff} дн.</span>
        return null
    }

    const menuItems = [
        {
            label: 'Сегодня',
            icon: <Calendar size={14} className="text-green-500" />,
            onClick: () => {
                const dateStr = format(startOfToday(), 'yyyy-MM-dd')
                updateTask({ taskId: task.id, updates: { due_date: dateStr } })
                if (showToasts) toast.success("📅 Set to Today")
            }
        },
        {
            label: 'Завтра',
            icon: <Calendar size={14} className="text-orange-500" />,
            onClick: () => {
                const dateStr = format(addDays(startOfToday(), 1), 'yyyy-MM-dd')
                updateTask({ taskId: task.id, updates: { due_date: dateStr } })
                if (showToasts) toast.success("📅 Set to Tomorrow")
            }
        },
        {
            label: 'Следующая неделя',
            icon: <Calendar size={14} className="text-blue-500" />,
            onClick: () => {
                const dateStr = format(nextMonday(startOfToday()), 'yyyy-MM-dd')
                updateTask({ taskId: task.id, updates: { due_date: dateStr } })
                if (showToasts) toast.success("📅 Set to Next Week")
            }
        },
        { type: 'separator' as const },
        {
            label: 'Метки',
            icon: <TagIcon size={14} className="text-gray-400" />,
            submenu: allTags?.map(tag => {
                const isAttached = task.tags?.some((t: any) => t.id === tag.id)
                return {
                    label: tag.name,
                    icon: (
                        <div
                            className={clsx(
                                "w-2 h-2 rounded-full",
                                "ring-2 ring-offset-2 ring-blue-400"
                            )}
                            style={{ backgroundColor: tag.color }}
                        />
                    ),
                    onClick: () => toggleTag({ taskId: task.id, tagId: tag.id, isAttached })
                }
            })
        },
        { type: 'separator' as const },
        {
            label: 'Добавить в проект',
            icon: <MoreHorizontal size={14} className="text-gray-500" />, // Using MoreHorizontal as placeholder or maybe a Folder icon
            onClick: () => {
                // Trigger GlobalSearch in Move Mode
                window.dispatchEvent(new CustomEvent('open-move-task-search', { detail: task.id }))
            }
        },
        { type: 'separator' as const },
        {
            label: 'Удалить',
            icon: <Trash2 size={14} />,
            variant: 'danger' as const,
            onClick: () => {
                deleteTask(task.id)
                if (showToasts) {
                    toast.message("Задача удалена", {
                        description: "Вы можете найти её в корзине",
                        duration: 4000,
                        action: {
                            label: 'Отменить',
                            onClick: () => restoreTask.mutate(task.id)
                        }
                    })
                }
            }
        }
    ]

    return (
        <motion.div
            initial={disableAnimation ? false : { opacity: 0, y: 5 }}
            animate={disableAnimation ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.1 }}
            className="group relative"
            style={{ marginLeft: `${depth * 24}px` }}
            onContextMenu={handleContextMenu}
        >
            <div
                onClick={handleTaskClick}
                {...(isMobile ? listeners : {})}
                {...(isMobile ? attributes : {})}
                {...(isMobile ? swipeHandlers : {})} // Attach swipe handlers
                className={clsx(
                    "flex items-center gap-2 px-2 h-9 rounded-md transition-colors w-full select-none box-border border border-transparent",
                    isSelected ? "bg-blue-50 dark:bg-blue-900/20 !border-blue-100" : (isActive ? "bg-gray-100" : "hover:bg-gray-100/60"),
                    task.is_completed && "opacity-80"
                )}
            >
                <div
                    {...listeners}
                    {...attributes}
                    className="hidden md:block opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-gray-600 cursor-move transition-opacity -ml-1"
                >
                    <GripVertical size={14} />
                </div>

                <button
                    onClick={toggleStatus}
                    className={clsx("transition-colors", task.is_completed ? "text-gray-500" : "text-gray-300 hover:text-gray-500")}
                >
                    {task.is_completed ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                <div className="flex-1 min-w-0 flex items-center self-stretch">
                    {isMobile ? (
                        <span
                            className={clsx(
                                "w-full bg-transparent border-0 p-0 leading-tight",
                                "overflow-hidden whitespace-nowrap truncate text-sm block h-full content-center",
                                task.is_completed ? "text-gray-500 line-through decoration-gray-400" : clsx("text-gray-700 font-medium", task.is_project && "uppercase tracking-wide text-blue-800 font-bold")
                            )}
                        >
                            {task.title}
                        </span>
                    ) : (
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
                                task.is_completed ? "text-gray-500 line-through decoration-gray-400" : clsx("text-gray-700 font-medium", task.is_project && "uppercase tracking-wide text-blue-800 font-bold")
                            )}
                            spellCheck={false}
                        />
                    )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {/* Tags */}
                    {task.tags && task.tags.length > 0 && (
                        <div className="flex items-center gap-2">
                            {task.tags.map((tag: any) => (
                                <div
                                    key={tag.id}
                                    className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                                    style={{
                                        backgroundColor: `${tag.color}20`,
                                        color: tag.color,
                                        border: `1px solid ${tag.color}40`
                                    }}
                                    title={tag.name}
                                >
                                    {isMobile ? tag.name.slice(0, 4) : tag.name}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Date/Time */}
                    {task.due_date && (
                        <div
                            className="text-xs tabular-nums cursor-help"
                            title={format(new Date(task.due_date), 'dd MMM yyyy')}
                        >
                            {getRelativeDate(task.due_date)}
                        </div>
                    )}

                    {/* Chevron */}
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

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    items={menuItems as any}
                />
            )}
        </motion.div>
    )
}
