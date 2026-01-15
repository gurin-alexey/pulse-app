import TextareaAutosize from 'react-textarea-autosize'
import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { useDeleteTask } from "@/hooks/useDeleteTask"
import { CheckSquare, Square, GripVertical, Calendar, ChevronRight, Tag as TagIcon, Trash2, MoreHorizontal, FolderInput, List, ArrowRight, Repeat, SkipForward } from "lucide-react"
import { useTags, useToggleTaskTag } from '@/hooks/useTags'
import clsx from "clsx"
import { motion, useMotionValue, useTransform, useAnimation, type PanInfo } from "framer-motion"
import { addDays, nextMonday, format, startOfToday, differenceInCalendarDays } from "date-fns"
import { ru } from 'date-fns/locale'
import { toast } from "sonner"


import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useSettings } from "@/store/useSettings"
import { useTrashActions } from "@/hooks/useTrashActions"
import { ContextMenu } from "@/shared/components/ContextMenu"
import { RecurrenceEditModal } from "@/components/ui/date-picker/RecurrenceEditModal"
import { useCreateTask } from "@/hooks/useCreateTask"
import { useTaskOccurrence } from "@/hooks/useTaskOccurrence"
import { addUntilToRRule, updateDTStartInRRule } from '@/utils/recurrence'
import { useTaskMenu } from '@/hooks/useTaskMenu'
import { useDeleteRecurrence } from '@/hooks/useDeleteRecurrence'
import { DeleteRecurrenceModal } from '@/components/ui/date-picker/DeleteRecurrenceModal'
import { useTaskCompletion } from '@/hooks/useTaskCompletion'
import { OccurrenceCompletionModal } from '@/components/ui/modals/OccurrenceCompletionModal'

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
    viewMode?: 'today' | 'tomorrow' | 'inbox' | 'project' | 'all'
    disableStrikethrough?: boolean
    occurrencesMap?: Record<string, string>
}

export function TaskItem({ task, isActive, depth = 0, listeners, attributes, hasChildren, isCollapsed, onToggleCollapse, disableAnimation, onIndent, onOutdent, viewMode, disableStrikethrough, occurrencesMap }: TaskItemProps) {
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

    // Task Completion logic
    const {
        toggleStatus: handleToggleStatus,
        isModalOpen: completionModalOpen,
        setIsModalOpen: setCompletionModalOpen,
        pastInstances,
        handleConfirmPast
    } = useTaskCompletion()

    // Recurrence Logic
    const [recurrenceEditModalOpen, setRecurrenceEditModalOpen] = useState(false)
    const [allowedModes, setAllowedModes] = useState<('single' | 'following' | 'all')[] | undefined>()
    const [pendingDateUpdate, setPendingDateUpdate] = useState<string | null>(null)
    const { mutate: createTask } = useCreateTask()
    const { setOccurrenceStatus, removeOccurrence } = useTaskOccurrence()

    const isVirtual = task.id.includes('_recur_')
    const realTaskId = isVirtual ? task.id.split('_recur_')[0] : task.id
    const virtualDate = isVirtual ? format(new Date(Number(task.id.split('_recur_')[1])), 'yyyy-MM-dd') : null
    const targetDate = virtualDate || (task.recurrence_rule ? task.due_date : null)

    // Deletion Modal
    const [showDeleteRecurrenceModal, setShowDeleteRecurrenceModal] = useState(false)
    const { handleDeleteInstance, handleDeleteFuture, handleDeleteAll } = useDeleteRecurrence({
        task,
        taskId: realTaskId,
        occurrenceDate: targetDate,
        onSuccess: () => setShowDeleteRecurrenceModal(false)
    })

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

        const handleClickOutside = (e: MouseEvent) => {
            // Optional: check if target is inside action buttons?
            // For now, let's just rely on click bubbling.
            // If the user clicks a button, the button's onClick (with stopPropagation) handles it.
            // If the user clicks elsewhere, this fires.
            resetSwipe()
        }

        // Small delay to prevent immediate closing if the click itself was the release
        const timer = setTimeout(() => {
            window.addEventListener('click', handleClickOutside)
            // Removed touchstart to avoid pre-emptively closing before button click
        }, 100)

        return () => {
            clearTimeout(timer)
            window.removeEventListener('click', handleClickOutside)
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
        handleToggleStatus(task, virtualDate || undefined, occurrencesMap)
    }

    const saveTitle = () => {
        if (title.trim() !== task.title) {
            updateTask({ taskId: realTaskId, updates: { title: title.trim() } })
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

    const handleRecurrenceUpdateConfirm = (mode: 'single' | 'following' | 'all') => {
        if (!pendingDateUpdate) return

        // Parse ID if virtual
        let realTaskId = task.id
        let occurrenceDate = null
        if (realTaskId.includes('_recur_')) {
            const parts = realTaskId.split('_recur_')
            realTaskId = parts[0]
            occurrenceDate = parts[1]
        }

        if (mode === 'single') {
            if (occurrenceDate) {
                setOccurrenceStatus({ taskId: realTaskId, date: occurrenceDate, status: 'archived' })
            }
            createTask({
                title: task.title,
                description: task.description,
                priority: task.priority,
                projectId: task.project_id,
                userId: task.user_id,
                parentId: task.parent_id,
                due_date: pendingDateUpdate,
                // Maintain time if present
                start_time: task.start_time ? `${pendingDateUpdate}T${task.start_time.split('T')[1]}` : null,
                end_time: task.end_time ? `${pendingDateUpdate}T${task.end_time.split('T')[1]}` : null,
            })
        }
        else if (mode === 'following') {
            if (occurrenceDate) {
                // 1. Truncate old series
                let splitDateMs = new Date(occurrenceDate).getTime()
                if (task.start_time) {
                    const timePart = new Date(task.start_time).toISOString().split('T')[1]
                    splitDateMs = new Date(`${occurrenceDate}T${timePart}`).getTime()
                }
                const prevTime = new Date(splitDateMs - 1000)
                const oldRuleEnd = addUntilToRRule(task.recurrence_rule || '', prevTime)
                updateTask({ taskId: realTaskId, updates: { recurrence_rule: oldRuleEnd } })

                // 2. Create NEW series
                const newStartStr = task.start_time ?
                    `${pendingDateUpdate}T${task.start_time.split('T')[1]}` :
                    `${pendingDateUpdate}T00:00:00`

                const newStart = new Date(newStartStr)
                const newRule = updateDTStartInRRule(task.recurrence_rule || '', newStart)

                createTask({
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    projectId: task.project_id,
                    userId: task.user_id,
                    parentId: task.parent_id,
                    due_date: pendingDateUpdate,
                    start_time: task.start_time ? newStartStr : null,
                    end_time: task.end_time ? `${pendingDateUpdate}T${task.end_time.split('T')[1]}` : null,
                    recurrence_rule: newRule,
                })
            } else {
                // Master task -> Just move it? Or treate as All
                updateTask({ taskId: realTaskId, updates: { due_date: pendingDateUpdate } })
            }
        }
        else {
            // All: Update master
            updateTask({ taskId: realTaskId, updates: { due_date: pendingDateUpdate } })
        }

        setRecurrenceEditModalOpen(false)
        setPendingDateUpdate(null)
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

        const dateStr = format(newDate, 'yyyy-MM-dd')

        if (task.recurrence_rule) {
            const isFirstInstance = targetDate?.split('T')[0] === task.due_date?.split('T')[0]
            const isDateChange = dateStr !== targetDate

            let modes: ('single' | 'following' | 'all')[] = []
            if (isDateChange) {
                modes = ['single', 'following']
            } else if (isFirstInstance) {
                modes = ['single', 'all']
            } else {
                modes = ['single', 'following', 'all']
            }

            setAllowedModes(modes)
            setPendingDateUpdate(dateStr)
            setRecurrenceEditModalOpen(true)
            resetSwipe()
            return
        }

        updateTask({ taskId: realTaskId, updates: { due_date: dateStr } })
        if (showToasts) toast.success(`📅 ${msg}`)
        resetSwipe()
    }


    const menuItems = useTaskMenu({
        task,
        taskId: realTaskId,
        onDateChangeRequest: (dateStr) => {
            const isFirstInstance = targetDate?.split('T')[0] === task.due_date?.split('T')[0]
            const isDateChange = dateStr !== targetDate

            let modes: ('single' | 'following' | 'all')[] = []
            if (isDateChange) {
                modes = ['single', 'following']
            } else if (isFirstInstance) {
                modes = ['single', 'all']
            } else {
                modes = ['single', 'following', 'all']
            }

            setAllowedModes(modes)
            setPendingDateUpdate(dateStr)
            setRecurrenceEditModalOpen(true)
        },
        onDelete: () => {
            if (task.recurrence_rule && targetDate) {
                setShowDeleteRecurrenceModal(true)
            } else {
                deleteTask(realTaskId)
            }
        }
    })

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
            <div className="relative rounded-md overflow-hidden md:overflow-visible bg-gray-50">

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
                    data-task-swipe-area="true"
                >

                    {/* Drag Handle (Desktop) */}
                    <div
                        {...listeners}
                        {...attributes}
                        className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing transition-opacity items-center justify-center rounded hover:bg-gray-100/50"
                    >
                        <GripVertical size={18} />
                    </div>

                    {/* Completion Checkbox */}
                    <button
                        onClick={toggleStatus}
                        className={clsx("transition-colors cursor-pointer", task.is_completed ? "text-green-500" : "text-gray-300 hover:text-gray-500")}
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
                                    "overflow-hidden whitespace-nowrap truncate text-base block h-full content-center",
                                    task.is_completed && !disableStrikethrough ? "text-gray-400 line-through decoration-gray-300 font-normal" : clsx("text-gray-700 font-normal", task.is_project && "uppercase tracking-wide text-blue-800 font-bold")
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
                                    "overflow-hidden whitespace-nowrap truncate text-base block h-full content-center",
                                    task.is_completed && !disableStrikethrough ? "text-gray-400 line-through decoration-gray-300 font-normal" : clsx("text-gray-700 font-normal", task.is_project && "uppercase tracking-wide text-blue-800 font-bold")
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

                        {/* Recurrence Icon */}
                        {task.recurrence_rule && (
                            <div className="flex items-center justify-center text-gray-400" title="Повторяющаяся задача">
                                <Repeat size={14} />
                            </div>
                        )}

                        {/* Date/Time */}
                        <div className="flex items-center gap-2 text-xs">
                            {task.start_time && (
                                <div className={clsx(
                                    "tabular-nums",
                                    viewMode === 'today' ? "text-blue-600 font-medium" : "text-gray-500"
                                )}>
                                    {(() => {
                                        const t = task.start_time
                                        // Handle full ISO strings or dates by trying to parse if it contains 'T' or -
                                        if (t.includes('T') || t.includes('-')) {
                                            try {
                                                return format(new Date(t), 'HH:mm')
                                            } catch (e) {
                                                return t.slice(0, 5)
                                            }
                                        }
                                        return t.slice(0, 5)
                                    })()}
                                </div>
                            )}

                            {task.due_date && (() => {
                                const date = new Date(task.due_date)
                                const today = startOfToday()
                                const diff = differenceInCalendarDays(date, today)

                                // Hiding logic
                                if (viewMode === 'today' && diff === 0) return null
                                if (viewMode === 'tomorrow' && diff === 1) return null

                                let text = ''
                                let className = "text-gray-500"

                                if (diff < 0) {
                                    // Overdue
                                    text = `${Math.abs(diff)} дн.`
                                    className = "text-red-500 font-medium"
                                } else if (diff === 0) {
                                    text = "Сегодня"
                                } else if (diff === 1) {
                                    text = "Завтра"
                                } else {
                                    text = `${diff} дн.`
                                }

                                return (
                                    <div
                                        className={clsx("tabular-nums cursor-help", className)}
                                        title={format(date, 'dd MMM yyyy', { locale: ru })}
                                    >
                                        {text}
                                    </div>
                                )
                            })()}
                        </div>

                        {/* Chevron */}
                        <div
                            className={clsx(
                                "w-6 h-6 flex items-center justify-center cursor-pointer transition-transform hover:bg-gray-200 rounded shrink-0",
                                !hasChildren && "hidden",
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

            <RecurrenceEditModal
                isOpen={recurrenceEditModalOpen}
                onClose={() => {
                    setRecurrenceEditModalOpen(false)
                    setPendingDateUpdate(null)
                    setAllowedModes(undefined)
                }}
                onConfirm={handleRecurrenceUpdateConfirm}
                allowedModes={allowedModes}
                title="Изменение даты повторяющейся задачи"
            />

            <DeleteRecurrenceModal
                isOpen={showDeleteRecurrenceModal}
                onClose={() => setShowDeleteRecurrenceModal(false)}
                onDeleteInstance={handleDeleteInstance}
                onDeleteFuture={handleDeleteFuture}
                onDeleteAll={handleDeleteAll}
                isFirstInstance={task.due_date === targetDate}
            />

            <OccurrenceCompletionModal
                isOpen={completionModalOpen}
                onClose={() => setCompletionModalOpen(false)}
                onConfirm={handleConfirmPast}
                pastInstances={pastInstances}
            />
        </motion.div>
    )
}
