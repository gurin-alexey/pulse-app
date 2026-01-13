import { useEffect, useState, useRef, Fragment } from 'react'
import { Menu, Transition, Dialog } from '@headlessui/react'
import TextareaAutosize from 'react-textarea-autosize'
import { toast } from 'sonner'
import { Loader2, CheckSquare, Square, Trash2, Calendar as CalendarIcon, ArrowUp, Flag, Repeat, MoreHorizontal, Tag as TagIcon, FolderInput, ArrowRight, SkipForward, History } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { format, subDays, addDays, startOfToday, nextMonday } from 'date-fns'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useTask } from '@/hooks/useTask'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useCreateTask } from '@/hooks/useCreateTask'
import { useDeleteTask } from '@/hooks/useDeleteTask'
import { useTrashActions } from '@/hooks/useTrashActions'
import { useSettings } from '@/store/useSettings'
import { useTags, useToggleTaskTag } from '@/hooks/useTags'
import { useTaskDateHotkeys } from '@/hooks/useTaskDateHotkeys'
import { useTaskOccurrence } from '@/hooks/useTaskOccurrence'
import { addExDateToRRule, addUntilToRRule, updateDTStartInRRule } from '@/utils/recurrence'
import { useTaskMenu } from '@/hooks/useTaskMenu'
import { useDeleteRecurrence } from '@/hooks/useDeleteRecurrence'
import { DeleteRecurrenceModal } from '@/components/ui/date-picker/DeleteRecurrenceModal'

import { ContextMenu } from '@/shared/components/ContextMenu'
import { SubtaskList } from './SubtaskList'
import { CategoryTags } from '../tags/CategoryTags'
import { ProjectPicker } from './ProjectPicker'
import { DatePickerPopover } from '@/components/ui/date-picker/DatePickerPopover'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { RecurrenceEditModal } from '@/components/ui/date-picker/RecurrenceEditModal'
import { TaskHistoryList } from './components/TaskHistoryList'

type TaskDetailProps = {
    taskId: string
    occurrenceDate?: string | null
}

export function TaskDetail({ taskId, occurrenceDate }: TaskDetailProps) {
    // Parse composite ID if present (e.g. from URL for recurring instance)
    const isCompositeId = taskId.includes('_recur_')
    let realTaskId = taskId
    let embeddedDate: string | null = null

    if (isCompositeId) {
        const parts = taskId.split('_recur_')
        realTaskId = parts[0]
        const timestamp = Number(parts[1])
        if (!isNaN(timestamp)) {
            embeddedDate = format(new Date(timestamp), 'yyyy-MM-dd')
        }
    }

    const [searchParams, setSearchParams] = useSearchParams()
    const { data: task, isLoading } = useTask(realTaskId)
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createTask } = useCreateTask()
    const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask()
    const { restoreTask } = useTrashActions()
    const { settings } = useSettings()

    // New hook for handling occurrences
    const { setOccurrenceStatus, removeOccurrence } = useTaskOccurrence()

    const showToasts = settings?.preferences.show_toast_hints !== false
    const [showDeleteRecurrenceModal, setShowDeleteRecurrenceModal] = useState(false)

    // Recurrence Edit (for Description and Date/Time)
    const [recurrenceEditModalOpen, setRecurrenceEditModalOpen] = useState(false)
    const [pendingDescription, setPendingDescription] = useState<string | null>(null)
    const [pendingDateUpdates, setPendingDateUpdates] = useState<any>(null)
    const [recurrenceAction, setRecurrenceAction] = useState<'description' | 'date-time'>('description')

    const [isHistoryOpen, setIsHistoryOpen] = useState(false)

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)
    const { mutate: toggleTag } = useToggleTaskTag()
    const { data: allTags } = useTags()

    // Breadcrumb Data
    const { data: parentTask } = useTask(task?.parent_id || '')

    // Enable hotkeys for this active task
    useTaskDateHotkeys(realTaskId, !!task)

    // Local state for auto-save inputs
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')

    // Instance handling (for recurrence)
    const occurrence = occurrenceDate ?? searchParams.get('occurrence') ?? embeddedDate
    const occurrenceDateStr = occurrence || null

    // Sync local state when task loads
    useEffect(() => {
        if (task) {
            setTitle(task.title || '')
            setDescription(task.description || '')
        }
    }, [task])

    // Keep track of values for unmount check
    const titleRef = useRef(title)
    const descriptionRef = useRef(description)

    // Track if this was opened as a new task
    const isNew = searchParams.get('isNew') === 'true'
    const isNewRef = useRef(isNew)

    useEffect(() => {
        titleRef.current = title
        descriptionRef.current = description
    }, [title, description])

    // Cleanup empty new tasks on unmount
    useEffect(() => {
        return () => {
            const currentParams = new URLSearchParams(window.location.search)
            const closing = !currentParams.get('task')
            const isEmpty = !titleRef.current.trim() && !descriptionRef.current.trim()

            if (closing && isEmpty && isNewRef.current) {
                deleteTask(realTaskId)
            }
        }
    }, [realTaskId])

    // Fetch status for this specific occurrence if it exists
    const { data: occurrenceData } = useQuery({
        queryKey: ['occurrence', realTaskId, occurrenceDateStr],
        queryFn: async () => {
            if (!occurrenceDateStr) return null
            const { data, error } = await supabase
                .from('task_occurrences')
                .select('status')
                .eq('task_id', realTaskId)
                .eq('original_date', occurrenceDateStr)
                .maybeSingle()

            return data
        },
        enabled: !!occurrenceDateStr
    })

    const isInstanceCompleted = occurrenceData?.status === 'completed'
    // Status logic: if virtual instance, rely on DB record. Default to parent task status if no record.
    const isCompleted = occurrence ? isInstanceCompleted : task?.is_completed

    const handleTitleBlur = () => {
        if (!task) return
        if (title !== task.title) {
            updateTask({ taskId: realTaskId, updates: { title } })
        }
    }

    const handleRecurrenceUpdateConfirm = (mode: 'single' | 'following' | 'all') => {
        if (!task) return

        if (recurrenceAction === 'description') {
            if (pendingDescription === null) return

            if (mode === 'single') {
                if (occurrenceDateStr) {
                    setOccurrenceStatus({
                        taskId: realTaskId,
                        date: occurrenceDateStr,
                        status: 'archived'
                    })

                    let startTime = null
                    let endTime = null
                    if (task.start_time) {
                        const timePart = new Date(task.start_time).toISOString().split('T')[1]
                        startTime = `${occurrenceDateStr}T${timePart}`
                        if (task.end_time) {
                            const startMs = new Date(task.start_time).getTime()
                            const endMs = new Date(task.end_time).getTime()
                            const duration = endMs - startMs
                            endTime = new Date(new Date(startTime).getTime() + duration).toISOString()
                        }
                    }

                    createTask({
                        title: task.title,
                        description: pendingDescription,
                        priority: task.priority,
                        projectId: task.project_id,
                        userId: task.user_id,
                        parentId: task.parent_id,
                        due_date: occurrenceDateStr,
                        start_time: startTime,
                        end_time: endTime
                    })
                }
            }
            else if (mode === 'following') {
                if (occurrenceDateStr) {
                    let splitDateMs = new Date(occurrenceDateStr).getTime()
                    if (task.start_time) {
                        const timePart = new Date(task.start_time).toISOString().split('T')[1]
                        splitDateMs = new Date(`${occurrenceDateStr}T${timePart}`).getTime()
                    }

                    const prevTime = new Date(splitDateMs - 1000)
                    const oldRuleEnd = addUntilToRRule(task.recurrence_rule || '', prevTime)
                    updateTask({ taskId: realTaskId, updates: { recurrence_rule: oldRuleEnd } })

                    const newStart = new Date(splitDateMs)
                    const newRule = updateDTStartInRRule(task.recurrence_rule || '', newStart)

                    let startTime = null
                    let endTime = null
                    if (task.start_time) {
                        startTime = newStart.toISOString()
                        if (task.end_time) {
                            const startMs = new Date(task.start_time).getTime()
                            const endMs = new Date(task.end_time).getTime()
                            const duration = endMs - startMs
                            endTime = new Date(newStart.getTime() + duration).toISOString()
                        }
                    }

                    createTask({
                        title: task.title,
                        description: pendingDescription,
                        priority: task.priority,
                        projectId: task.project_id,
                        userId: task.user_id,
                        parentId: task.parent_id,
                        due_date: occurrenceDateStr,
                        start_time: startTime,
                        end_time: endTime,
                        recurrence_rule: newRule
                    })
                }
            }
            else {
                updateTask({ taskId: realTaskId, updates: { description: pendingDescription } })
            }
            setPendingDescription(null)
        } else if (recurrenceAction === 'date-time') {
            if (!pendingDateUpdates) return

            // "Single": Detach instance at NEW time
            if (mode === 'single') {
                if (occurrenceDateStr) {
                    // Archive the OLD slot
                    setOccurrenceStatus({
                        taskId: realTaskId,
                        date: occurrenceDateStr,
                        status: 'archived'
                    })

                    // Create NEW task with NEW updates
                    createTask({
                        title: task.title,
                        description: task.description,
                        priority: task.priority,
                        projectId: task.project_id,
                        userId: task.user_id,
                        parentId: task.parent_id,
                        // Defaults from original task, overwritten by updates
                        due_date: occurrenceDateStr, // Default to old date, will be overwritten by pendingDateUpdates
                        start_time: task.start_time ? `${occurrenceDateStr}T${task.start_time.split('T')[1]}` : null,
                        end_time: task.end_time ? `${occurrenceDateStr}T${task.end_time.split('T')[1]}` : null,
                        ...pendingDateUpdates
                    })
                }
            }
            // "Following": Split the series
            else if (mode === 'following') {
                if (occurrenceDateStr) {
                    // 1. Truncate old series at previous instance
                    let splitDateMs = new Date(occurrenceDateStr).getTime()
                    if (task.start_time) {
                        const timePart = new Date(task.start_time).toISOString().split('T')[1]
                        splitDateMs = new Date(`${occurrenceDateStr}T${timePart}`).getTime()
                    }
                    const prevTime = new Date(splitDateMs - 1000)
                    const oldRuleEnd = addUntilToRRule(task.recurrence_rule || '', prevTime)
                    updateTask({ taskId: realTaskId, updates: { recurrence_rule: oldRuleEnd } })

                    // 2. Create NEW series
                    const newStartStr = pendingDateUpdates.start_time ||
                        (pendingDateUpdates.due_date ? `${pendingDateUpdates.due_date}T00:00:00` : null) ||
                        new Date(splitDateMs).toISOString()

                    const newStart = new Date(newStartStr)
                    const newRule = updateDTStartInRRule(task.recurrence_rule || '', newStart)

                    createTask({
                        title: task.title,
                        description: task.description,
                        priority: task.priority,
                        projectId: task.project_id,
                        userId: task.user_id,
                        parentId: task.parent_id,
                        due_date: pendingDateUpdates.due_date || occurrenceDateStr,
                        start_time: pendingDateUpdates.start_time || (task.start_time ? newStartStr : null),
                        end_time: pendingDateUpdates.end_time || null,
                        recurrence_rule: newRule,
                    })
                }
            }
            // "All": Update master task
            else {
                updateTask({ taskId: realTaskId, updates: pendingDateUpdates })
            }
            setPendingDateUpdates(null)
        }

        setRecurrenceEditModalOpen(false)
    }

    const handleDescriptionBlur = () => {
        if (!task) return
        if (description !== task.description) {
            // If recurring AND currently on an occurrence (virtual instance), ask user
            if (task.recurrence_rule && occurrenceDateStr && occurrence) {
                setPendingDescription(description)
                setRecurrenceAction('description')
                setRecurrenceEditModalOpen(true)
            } else {
                updateTask({ taskId: realTaskId, updates: { description } })
            }
        }
    }

    const toggleStatus = () => {
        if (!task) return

        if (occurrence && occurrenceDateStr) {
            if (isInstanceCompleted) {
                // If it was completed, we remove the record -> back to pending (not completed)
                removeOccurrence({ taskId: realTaskId, date: occurrenceDateStr })
            } else {
                // Mark as completed
                setOccurrenceStatus({ taskId: realTaskId, date: occurrenceDateStr, status: 'completed' })
            }
        } else {
            updateTask({ taskId: realTaskId, updates: { is_completed: !task.is_completed } })
        }
    }

    const handleDelete = () => {
        if (occurrenceDateStr && task?.recurrence_rule) {
            setShowDeleteRecurrenceModal(true)
            return
        }

        deleteTask(realTaskId)
    }

    const { handleDeleteInstance, handleDeleteFuture, handleDeleteAll } = useDeleteRecurrence({
        task,
        taskId: realTaskId,
        occurrenceDate: occurrenceDateStr,
        onSuccess: () => setShowDeleteRecurrenceModal(false)
    })

    const handleDetachInstance = () => {
        if (!task || !occurrence) return

        const occDate = new Date(occurrence as string)

        // 1. Update original task to exclude this date
        const newRule = addExDateToRRule(task.recurrence_rule || '', occDate)
        updateTask({ taskId: realTaskId, updates: { recurrence_rule: newRule } })

        // 2. Create new standalone task at the instance position
        const dateStr = format(occDate, 'yyyy-MM-dd')

        let endTime = null
        if (task.start_time && task.end_time) {
            const start = new Date(task.start_time)
            const end = new Date(task.end_time)
            const duration = end.getTime() - start.getTime()
            endTime = new Date(occDate.getTime() + duration).toISOString()
        }

        createTask({
            title: task.title,
            description: task.description,
            priority: task.priority,
            projectId: task.project_id,
            userId: task.user_id,
            due_date: dateStr,
            start_time: task.start_time ? occDate.toISOString() : null,
            end_time: endTime
        }, {
            onSuccess: (nt: any) => {
                setSearchParams({ task: nt.id })
            }
        })
    }

    const handleBreadcrumbClick = () => {
        if (task?.parent_id) {
            setSearchParams({ task: task.parent_id })
        }
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY })
    }

    const menuItems = useTaskMenu({
        task,
        taskId: realTaskId,
        occurrenceDate: occurrenceDateStr,
        onDateChangeRequest: (dateStr) => {
            setPendingDateUpdates({ due_date: dateStr })
            setRecurrenceAction('date-time')
            setRecurrenceEditModalOpen(true)
        },
        onDelete: handleDelete,
        onSkipOccurrence: () => {
            setContextMenu(null)
            setSearchParams({}) // Close detail view
        }
    })

    // Safety fallback for rendering while loading/creating
    const t = task || ({
        id: realTaskId,
        title: '',
        description: '',
        priority: 'none',
        is_completed: false,
        project_id: null,
        parent_id: null,
        due_date: null,
        start_time: null,
        end_time: null,
        recurrence_rule: null,
        is_project: false
    } as any)


    return (
        <div
            className="h-full flex flex-col bg-white overflow-hidden"
            onContextMenu={handleContextMenu}
        >
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 pt-3">
                <div className="mb-2 space-y-2">


                    {/* Occurrence Detach Banner */}
                    {occurrence && t.recurrence_rule && (
                        <div className="mb-2 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2.5 text-blue-700">
                                <Repeat size={16} className="shrink-0" />
                                <span className="text-sm font-medium">Это повторение задачи за {format(new Date(occurrence), 'd MMM')}</span>
                            </div>
                            <button
                                onClick={handleDetachInstance}
                                className="px-3 py-1 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-50 transition-colors shadow-sm active:scale-95 transition-transform"
                            >
                                Сделать отдельной
                            </button>
                        </div>
                    )}

                    {/* Task Header (No Frame) */}
                    <div className="group/card">

                        {/* Top Meta Row */}
                        <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-4">
                            {/* Checkbox */}
                            <button
                                onClick={toggleStatus}
                                className={clsx("transition-colors shrink-0", isCompleted ? "text-green-500" : "text-gray-400 hover:text-gray-600")}
                            >
                                {isCompleted ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>

                            {/* Divider */}
                            <div className="w-px h-5 bg-gray-200" />

                            {/* Date Picker */}
                            <DatePickerPopover
                                date={t.due_date ? new Date(t.due_date) : null}
                                time={t.start_time ? new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null}
                                endTime={t.end_time ? new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null}
                                recurrenceRule={t.recurrence_rule || null}
                                onUpdate={({ date, time, endTime, recurrenceRule }) => {
                                    const updates: Record<string, string | null | undefined> = {}
                                    if (date) {
                                        updates.due_date = format(date, 'yyyy-MM-dd')

                                        if (time) {
                                            const [h, m] = time.split(':').map(Number)
                                            const newStart = new Date(date)
                                            newStart.setHours(h, m, 0, 0)
                                            updates.start_time = newStart.toISOString()

                                            if (endTime) {
                                                const [eh, em] = endTime.split(':').map(Number)
                                                const newEnd = new Date(date)
                                                newEnd.setHours(eh, em, 0, 0)
                                                updates.end_time = newEnd.toISOString()
                                            } else {
                                                updates.end_time = null
                                            }
                                        } else {
                                            updates.start_time = null
                                            updates.end_time = null
                                        }
                                        updates.recurrence_rule = recurrenceRule
                                    } else {
                                        updates.due_date = null
                                        updates.start_time = null
                                        updates.end_time = null
                                        updates.recurrence_rule = null
                                    }

                                    // Check for recurrence interception
                                    if (t.recurrence_rule && occurrence && (updates.due_date !== t.due_date || updates.start_time !== t.start_time || updates.end_time !== t.end_time)) {
                                        setPendingDateUpdates(updates)
                                        setRecurrenceAction('date-time')
                                        setRecurrenceEditModalOpen(true)
                                    } else {
                                        updateTask({ taskId: realTaskId, updates })
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 transition-all cursor-pointer group/date" title="Set Date">
                                    <CalendarIcon size={16} className={clsx("group-hover/date:text-blue-500", t.due_date ? "text-blue-600" : "text-gray-400")} />
                                    <span className={clsx("text-sm", t.due_date ? "text-gray-700 font-medium" : "text-gray-400 italic")}>
                                        {t.due_date ? format(new Date(t.due_date), 'MMM d') : 'Set Date'}
                                        {t.start_time && <span className="ml-1 text-gray-500 font-normal">
                                            {new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            {t.end_time && ` - ${new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`}
                                        </span>}
                                        {t.recurrence_rule && <Repeat size={12} className="inline ml-1 text-blue-500" />}
                                    </span>
                                </div>
                            </DatePickerPopover>

                            <div className="flex-1" />

                            {/* Priority Selection Menu */}
                            <Menu as="div" className="relative">
                                <Menu.Button
                                    className={clsx(
                                        "p-2 rounded-md transition-colors hover:bg-gray-100",
                                        t.priority === 'high' ? "text-red-500" :
                                            t.priority === 'medium' ? "text-amber-500" :
                                                t.priority === 'low' ? "text-blue-500" :
                                                    "text-gray-400 hover:text-gray-600"
                                    )}
                                    title={`Priority: ${t.priority || 'Normal'}`}
                                >
                                    <Flag size={18} className={clsx(t.priority && t.priority !== 'none' && "fill-current")} />
                                </Menu.Button>

                                <Transition
                                    as={Fragment}
                                    enter="transition ease-out duration-100"
                                    enterFrom="transform opacity-0 scale-95"
                                    enterTo="transform opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="transform opacity-100 scale-100"
                                    leaveTo="transform opacity-0 scale-95"
                                >
                                    <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-30 overflow-hidden">
                                        <div className="p-1">
                                            {[
                                                { id: 'none', label: 'Normal', color: 'text-gray-500', bg: 'hover:bg-gray-50' },
                                                { id: 'low', label: 'Low Priority', color: 'text-blue-500', bg: 'hover:bg-blue-50' },
                                                { id: 'medium', label: 'Medium Priority', color: 'text-amber-500', bg: 'hover:bg-amber-50' },
                                                { id: 'high', label: 'High Priority', color: 'text-red-500', bg: 'hover:bg-red-50' }
                                            ].map((opt) => (
                                                <Menu.Item key={opt.id}>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={() => updateTask({ taskId: realTaskId, updates: { priority: (opt.id === 'none' ? null : opt.id) as any } })}
                                                            className={clsx(
                                                                "flex w-full items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                                                                active ? opt.bg : "bg-white",
                                                                opt.color
                                                            )}
                                                        >
                                                            <Flag size={14} className={clsx(t.priority === opt.id && "fill-current")} />
                                                            {opt.label}
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            ))}
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>

                        </div>

                        {/* Breadcrumbs (Moved here) */}
                        {t.parent_id && parentTask && (
                            <div className="mb-4 pl-0">
                                <div
                                    onClick={handleBreadcrumbClick}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:bg-white hover:border-gray-300 hover:text-blue-600 hover:shadow-sm cursor-pointer w-fit transition-all group"
                                >
                                    <ArrowUp size={14} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                                    <span className="font-medium text-xs truncate max-w-[300px]">Return to <span className="font-semibold text-gray-700 group-hover:text-blue-700 uppercase">{parentTask.title}</span></span>
                                </div>
                            </div>
                        )}

                        {/* Title Row */}
                        <TextareaAutosize
                            autoFocus={searchParams.get('isNew') === 'true'}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={handleTitleBlur}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    (e.target as HTMLTextAreaElement).blur();
                                }
                            }}
                            onContextMenu={(e) => e.stopPropagation()} // Allow native menu
                            className={clsx(
                                "w-full text-xl font-semibold bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-gray-800 placeholder:text-gray-300 resize-none overflow-hidden leading-snug",
                                t.is_project && "uppercase tracking-wide text-blue-800"
                            )}
                            placeholder="What needs to be done?"
                            minRows={1}
                        />

                    </div>


                    <div onContextMenu={(e) => e.stopPropagation()}>
                        <RichTextEditor
                            key={task?.id} // Force re-render when task changes
                            content={description}
                            onChange={setDescription}
                            onBlur={handleDescriptionBlur}
                            className="mt-4"
                            placeholder="Add a description..."
                        />
                    </div>

                    <SubtaskList taskId={realTaskId} projectId={t.project_id} isProject={t.is_project} />
                </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 w-full px-6 py-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 flex items-center justify-between gap-4 z-20">
                {/* Meta Controls (Left) */}
                <div className="flex flex-wrap items-center gap-4">


                    {/* Project & Section Picker */}
                    <ProjectPicker
                        projectId={t.project_id || null}
                        sectionId={t.section_id || null}
                        onSelect={(pid, sid) => {
                            if (pid !== t.project_id || sid !== t.section_id) {
                                updateTask({
                                    taskId: realTaskId,
                                    updates: {
                                        project_id: pid ?? null, // Use null for Inbox
                                        section_id: sid
                                    }
                                })
                            }
                        }}
                    />

                    {/* Categorized Tags (Place, Energy, Time, People) */}
                    <CategoryTags taskId={realTaskId} />

                    {/* Project Type Toggle (GTD logic) */}
                    <div className="flex items-center gap-2 border-l border-gray-100 pl-4 py-1">
                        <button
                            onClick={() => updateTask({ taskId: realTaskId, updates: { is_project: !t.is_project } })}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all tracking-wider",
                                t.is_project
                                    ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-100 ring-offset-1"
                                    : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 border border-gray-200"
                            )}
                            title="Сделать проектом"
                        >
                            Проект
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsHistoryOpen(true)}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        title="История изменений"
                    >
                        <History size={20} />
                    </button>
                    {/* Delete Button (Right) */}
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete task"
                    >
                        {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                    </button>
                </div>
            </div>
            {
                contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        onClose={() => setContextMenu(null)}
                        items={menuItems as any}
                    />
                )
            }
            <RecurrenceEditModal
                isOpen={recurrenceEditModalOpen}
                onClose={() => {
                    setRecurrenceEditModalOpen(false)
                    setPendingDescription(null)
                    setPendingDateUpdates(null)
                    // Revert description if needed
                    if (recurrenceAction === 'description') {
                        setDescription(task?.description || '')
                    }
                }}
                onConfirm={handleRecurrenceUpdateConfirm}
                title={recurrenceAction === 'date-time' ? "Изменение времени повторяющейся задачи" : "Изменение описания повторяющейся задачи"}
            />
            {/* Delete Recurrence Modal */}
            <DeleteRecurrenceModal
                isOpen={showDeleteRecurrenceModal}
                onClose={() => setShowDeleteRecurrenceModal(false)}
                onDeleteInstance={handleDeleteInstance}
                onDeleteFuture={handleDeleteFuture}
                onDeleteAll={handleDeleteAll}
                isFirstInstance={task?.due_date === occurrenceDateStr}
            />

            {/* History Modal */}
            <Transition appear show={isHistoryOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsHistoryOpen(false)}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                                    <Dialog.Title
                                        as="h3"
                                        className="text-lg font-medium leading-6 text-gray-900 mb-4 flex items-center gap-2"
                                    >
                                        <History size={20} className="text-gray-500" />
                                        История изменений
                                    </Dialog.Title>

                                    <div className="max-h-[60vh] overflow-y-auto -mr-2 pr-2">
                                        <TaskHistoryList taskId={realTaskId} />
                                    </div>

                                    <div className="mt-8 flex justify-end">
                                        <button
                                            type="button"
                                            className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                                            onClick={() => setIsHistoryOpen(false)}
                                        >
                                            Закрыть
                                        </button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    )
}
