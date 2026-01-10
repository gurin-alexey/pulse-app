import TextareaAutosize from 'react-textarea-autosize'
import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { useDeleteTask } from "@/hooks/useDeleteTask"
import { CheckSquare, Square, GripVertical, Calendar, ChevronRight, Tag as TagIcon, Trash2, MoreHorizontal, FolderInput, List, ArrowRight } from "lucide-react"
import { useTags, useToggleTaskTag } from '@/hooks/useTags'
import clsx from "clsx"
import { motion, useMotionValue, useTransform, useAnimation, type PanInfo } from "framer-motion"
import { addDays, nextMonday, format, startOfToday, differenceInCalendarDays } from "date-fns"
import { toast } from "sonner"


import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useSettings } from "@/store/useSettings"
import { useTrashActions } from "@/hooks/useTrashActions"
import { ContextMenu } from "@/shared/components/ContextMenu"

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
}

export function TaskItem({ task, isActive, depth = 0, listeners, attributes, hasChildren, isCollapsed, onToggleCollapse, disableAnimation, onIndent, onOutdent }: TaskItemProps) {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: deleteTask } = useDeleteTask()
    const { restoreTask } = useTrashActions()
    const { mutate: toggleTag } = useToggleTaskTag()
    const { data: allTags } = useTags()
    const { settings } = useSettings()

    const showToasts = settings?.preferences.show_toast_hints !== false

    const isMobile = useMediaQuery("(max-width: 768px)")

    // Local state for inline editing
    const [title, setTitle] = useState(task.title)
    const [isEditing, setIsEditing] = useState(false)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)

    // --- SWIPE LOGIC ---
    const controls = useAnimation()
    const x = useMotionValue(0)
    const [isOpen, setIsOpen] = useState(false)

    // Background opacity effects based on drag
    const leftActionOpacity = useTransform(x, [0, 50], [0, 1])
    const rightActionOpacity = useTransform(x, [0, -50], [0, 1])

    const handleDragEnd = async (event: any, info: PanInfo) => {
        const offset = info.offset.x
        const velocity = info.velocity.x

        if (offset < -50 || (offset < -10 && velocity < -200)) {
            // Swiped Left -> Reveal Date Options (Now needing more space)
            await controls.start({ x: -180, transition: { type: "spring", stiffness: 300, damping: 30 } })
            setIsOpen(true)
        } else if (offset > 50 || (offset > 10 && velocity > 200)) {
            // Swiped Right -> Reveal Project/List Options
            await controls.start({ x: 120, transition: { type: "spring", stiffness: 300, damping: 30 } })
            setIsOpen(true)
        } else {
            // Reset
            await controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } })
            setIsOpen(false)
        }
    }

    const resetSwipe = () => {
        controls.start({ x: 0 })
        setIsOpen(false)
    }

    // Close on click outside (simulated by global click listener when open)
    useEffect(() => {
        if (!isOpen) return

        const handleClickOutside = () => {
            resetSwipe()
        }
        // Small delay to prevent immediate closing if the click itself was the release
        const timer = setTimeout(() => {
            window.addEventListener('click', handleClickOutside)
            window.addEventListener('touchstart', handleClickOutside)
        }, 100)

        return () => {
            clearTimeout(timer)
            window.removeEventListener('click', handleClickOutside)
            window.removeEventListener('touchstart', handleClickOutside)
        }
    }, [isOpen])

    // --- END SWIPE LOGIC ---


    // Sync title if task updates externally
    useEffect(() => {
        setTitle(task.title)
    }, [task.title])

    const handleTaskClick = (e: React.MouseEvent) => {
        if (isEditing) return
        if (Math.abs(x.get()) > 10 || isOpen) {
            // If open, let the outside click handler close it, don't navigate
            return
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

        if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLTextAreaElement).blur()
        }
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY })
    }

    const getRelativeDate = (dateStr: string) => {
        if (task.start_time) {
            const formatTime = (isoString: string) => {
                if (!isoString) return ''
                if (isoString.includes('T')) {
                    const date = new Date(isoString)
                    const hours = date.getHours()
                    const minutes = date.getMinutes()
                    return `${hours}:${minutes.toString().padStart(2, '0')}`
                }
                return isoString
            }
            const timeStr = formatTime(task.start_time)
            return <span className="text-blue-600 font-medium text-xs bg-blue-50 px-1.5 py-0.5 rounded">{timeStr}</span>
        }

        const date = new Date(dateStr)
        const today = startOfToday()
        const diff = differenceInCalendarDays(date, today)

        if (diff === 0) return null
        if (diff === 1) return <span className="text-gray-500">Завтра</span>
        if (diff > 1) return <span className="text-gray-500">{diff} дн.</span>
        if (diff < 0) return <span className="text-red-500 font-medium">{diff} дн.</span>
        return null
    }

    // --- ACTIONS ---
    const addToProject = (e: any) => {
        e.stopPropagation()
        resetSwipe()
        window.dispatchEvent(new CustomEvent('open-move-task-search', { detail: task.id }))
    }

    // Placeholder for "Add to List" - for now behaves like Project or we can add specific logic later
    const addToList = (e: any) => {
        e.stopPropagation()
        resetSwipe()
        // Re-use same search for now as lists/projects are often similar or same entity in some structures
        window.dispatchEvent(new CustomEvent('open-move-task-search', { detail: task.id }))
    }

    const setDate = (e: any, type: 'today' | 'tomorrow' | 'monday') => {
        e.stopPropagation()
        let newDate: Date;
        let msg = ""
        switch (type) {
            case 'today':
                newDate = startOfToday();
                msg = "Тогда"
                break;
            case 'tomorrow':
                newDate = addDays(startOfToday(), 1);
                msg = "Завтра"
                break;
            case 'monday':
                newDate = nextMonday(startOfToday());
                msg = "Понедельник"
                break;
            default:
                return
        }
        updateTask({ taskId: task.id, updates: { due_date: format(newDate, 'yyyy-MM-dd') } })
        if (showToasts) toast.success(`📅 ${msg}`)
        resetSwipe()
    }


    const menuItems = [
        // ... (Context menu items needed for desktop/long press)
        {
            label: 'Сегодня',
            icon: <Calendar size={14} className="text-green-500" />,
            onClick: () => {
                const dateStr = format(startOfToday(), 'yyyy-MM-dd')
                updateTask({ taskId: task.id, updates: { due_date: dateStr } })
            }
        },
        {
            label: 'Удалить',
            icon: <Trash2 size={14} />,
            variant: 'danger' as const,
            onClick: () => {
                deleteTask(task.id)
            }
        }
    ]

    const containerClasses = clsx(
        "relative flex items-center gap-2 px-2 h-9 bg-white transition-colors w-full select-none box-border border border-transparent z-10",
        isActive ? "bg-gray-100 placeholder:bg-gray-100" : "hover:bg-gray-100/60",
        task.is_completed && "opacity-80"
    )

    return (
        <motion.div
            initial={disableAnimation ? false : { opacity: 0, y: 5 }}
            animate={disableAnimation ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.1 }}
            className="group relative"
            style={{ marginLeft: `${depth * 24}px` }}
            onContextMenu={handleContextMenu}
        >
            {/* SWIPE CONTAINER */}
            <div className="relative rounded-md overflow-hidden bg-gray-50">

                {/* --- BACKGROUND ACTIONS --- */}

                {/* LEFT Actions (Visible when swiping RIGHT) -> Move To... */}
                <motion.div
                    style={{ opacity: leftActionOpacity }}
                    className="absolute inset-y-0 left-0 w-[120px] flex"
                >
                    <button
                        onClick={addToProject}
                        className="flex-1 bg-blue-500 flex flex-col items-center justify-center text-white gap-0.5 active:bg-blue-600"
                    >
                        <FolderInput size={16} />
                        <span className="text-[9px] font-bold">Проект</span>
                    </button>
                    <button
                        onClick={addToList}
                        className="flex-1 bg-indigo-500 flex flex-col items-center justify-center text-white gap-0.5 border-l border-white/20 active:bg-indigo-600"
                    >
                        <List size={16} />
                        <span className="text-[9px] font-bold">Список</span>
                    </button>
                </motion.div>

                {/* RIGHT Actions (Visible when swiping LEFT) -> Date... */}
                <motion.div
                    style={{ opacity: rightActionOpacity }}
                    className="absolute inset-y-0 right-0 w-[180px] flex"
                >
                    <button
                        onClick={(e) => setDate(e, 'today')}
                        className="flex-1 bg-green-500 flex flex-col items-center justify-center text-white gap-0.5 border-r border-white/20 active:bg-green-600"
                    >
                        <Calendar size={16} />
                        <span className="text-[9px] font-bold">Сегодня</span>
                    </button>
                    <button
                        onClick={(e) => setDate(e, 'tomorrow')}
                        className="flex-1 bg-orange-500 flex flex-col items-center justify-center text-white gap-0.5 border-r border-white/20 active:bg-orange-600"
                    >
                        <ArrowRight size={16} />
                        <span className="text-[9px] font-bold">Завтра</span>
                    </button>
                    <button
                        onClick={(e) => setDate(e, 'monday')}
                        className="flex-1 bg-purple-500 flex flex-col items-center justify-center text-white gap-0.5 active:bg-purple-600"
                    >
                        <Calendar size={16} />
                        <span className="text-[9px] font-bold">ПН</span>
                    </button>
                </motion.div>

                {/* --- FOREGROUND CONTENT (SWIPEABLE) --- */}
                <motion.div
                    drag={isMobile ? "x" : false} // Only swipe on mobile
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.05} // Stiffer drag to prevent wobbling
                    onDragStart={() => setIsOpen(true)}
                    onDragEnd={handleDragEnd}
                    animate={controls}
                    style={{ x }}
                    className={containerClasses}
                >

                    {/* Drag Handle (Desktop) */}
                    <div
                        {...listeners}
                        {...attributes}
                        className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-gray-600 cursor-move transition-opacity items-center justify-center"
                    >
                        <GripVertical size={14} />
                    </div>

                    {/* Completion Checkbox */}
                    <button
                        onClick={toggleStatus}
                        className={clsx("transition-colors cursor-pointer", task.is_completed ? "text-gray-500" : "text-gray-300 hover:text-gray-500")}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {task.is_completed ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>

                    {/* Title & Input */}
                    <div
                        className="flex-1 min-w-0 flex items-center self-stretch cursor-pointer"
                        onClick={handleTaskClick}
                        {...(isMobile ? listeners : {})}
                        {...(isMobile ? attributes : {})}
                    >
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
                </motion.div>
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
