import { useNavigate, Link } from "react-router-dom"
import { Folder, ChevronRight, FolderPlus, Trash2, Edit2, Plus, Calendar, LayoutDashboard, CheckSquare, Inbox, Sun, Tag as TagIcon, MoreHorizontal, Sunrise, RefreshCw, FolderInput, LogOut, Check, Smile } from "lucide-react"
import { useQueryClient, useIsFetching } from "@tanstack/react-query" // Import react-query hooks

// ... existing code ...

import { createPortal } from "react-dom"
import { useState, useRef, useEffect, useMemo } from "react"
import clsx from "clsx"
import { useProjects } from "@/hooks/useProjects"
import { useProjectGroups, useCreateProjectGroup, useDeleteProjectGroup, useUpdateProjectGroup } from "@/hooks/useProjectGroups"
import { useCreateProject } from "@/hooks/useCreateProject"
import { useUpdateProject } from "@/hooks/useUpdateProject"
import { useHabits } from "@/hooks/useHabits"
import { useCreateHabit } from "@/hooks/useCreateHabit"
import { useUpdateHabit } from "@/hooks/useUpdateHabit"
import { useDeleteHabit } from "@/hooks/useDeleteHabit"
import { useHabitLogs } from "@/hooks/useHabitLogs"
import { useUpsertHabitLog } from "@/hooks/useUpsertHabitLog"
import { useDeleteHabitLog } from "@/hooks/useDeleteHabitLog"
import { supabase } from "@/lib/supabase"
import { useDraggable, useDroppable, useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDeleteProject } from "@/hooks/useDeleteProject"
import { useAllTasks } from "@/hooks/useAllTasks"
import { useTasks } from "@/hooks/useTasks"
import { expandTasksForDate } from "@/utils/taskExpansion"
import { useTags } from "@/hooks/useTags"
import { isToday, isTomorrow, parseISO, subDays } from "date-fns"
import { CATEGORIES } from "@/constants/categories"
import type { Habit, HabitLog } from "@/types/database"
import { getProjectIcon } from "@/utils/projectIcons"
import { ProjectIconPicker } from "@/features/projects/ProjectIconPicker"

type SidebarProps = {
    activePath: string
    onItemClick?: () => void
}

// --- DND Components ---

function ProjectActionsMenu({ project, onRename, onDelete, onChangeIcon, isOver, groups, onMoveToGroup, onCreateGroup }: any) {
    const [isOpen, setIsOpen] = useState(false)
    const [view, setView] = useState<'main' | 'folders'>('main')
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false)
                setView('main')
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={menuRef} onClick={e => e.preventDefault()}>
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); setView('main') }}
                className={clsx(
                    "opacity-0 group-hover/project:opacity-100 p-1 rounded transition-all",
                    isOpen && "opacity-100 bg-gray-100/20",
                    isOver ? "text-blue-100 hover:bg-white/20 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                )}
                title="Project Settings"
            >
                <MoreHorizontal size={16} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 shadow-xl rounded-md z-50 py-1 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {view === 'main' ? (
                        <>
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onRename(project) }}
                                className="text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 w-full transition-colors"
                            >
                                <Edit2 size={13} className="text-gray-400" />
                                Rename
                            </button>
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onChangeIcon(e) }}
                                className="text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 w-full transition-colors"
                            >
                                <Smile size={13} className="text-gray-400" />
                                Change Icon
                            </button>
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setView('folders') }}
                                className="text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 w-full transition-colors"
                            >
                                <FolderInput size={13} className="text-gray-400" />
                                Move to Folder
                                <ChevronRight size={12} className="ml-auto text-gray-300" />
                            </button>
                            <div className="h-px bg-gray-50 my-0.5" />
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onDelete(e, project.id) }}
                                className="text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 w-full transition-colors"
                            >
                                <Trash2 size={13} className="text-red-500" />
                                Delete
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="px-2 py-1 flex items-center gap-2 border-b border-gray-50 mb-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setView('main') }}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-500"
                                >
                                    <ChevronRight size={12} className="rotate-180" />
                                </button>
                                <span className="text-xs font-semibold text-gray-500">Select Folder</span>
                            </div>

                            <div className="max-h-48 overflow-y-auto">
                                {project.group_id && (
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onMoveToGroup(null) }}
                                        className="text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 w-full transition-colors"
                                    >
                                        <LogOut size={13} className="rotate-180" />
                                        Remove from Folder
                                    </button>
                                )}

                                {groups?.map((group: any) => (
                                    group.id !== project.group_id && (
                                        <button
                                            key={group.id}
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onMoveToGroup(group.id) }}
                                            className="text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 w-full transition-colors"
                                        >
                                            <Folder size={13} className="text-gray-400" />
                                            {group.name}
                                        </button>
                                    )
                                ))}

                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onCreateGroup() }}
                                    className="text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-2 w-full transition-colors border-t border-gray-50 mt-1"
                                >
                                    <Plus size={13} />
                                    New Folder
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

function GroupActionsMenu({ group, onAddProject, onRename, onDelete }: any) {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={menuRef} onClick={e => e.preventDefault()}>
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen) }}
                className={clsx(
                    "opacity-0 group-hover/title:opacity-100 p-1 rounded transition-all text-gray-400 hover:bg-gray-100 hover:text-gray-700",
                    isOpen && "opacity-100 bg-gray-100/20"
                )}
                title="Folder Options"
            >
                <MoreHorizontal size={16} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 shadow-xl rounded-md z-50 py-1 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onAddProject() }}
                        className="text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 w-full transition-colors"
                    >
                        <Plus size={13} className="text-gray-400" />
                        Add Project
                    </button>
                    <div className="h-px bg-gray-50 my-0.5" />
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onRename() }}
                        className="text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 w-full transition-colors"
                    >
                        <Edit2 size={13} className="text-gray-400" />
                        Rename
                    </button>
                    <div className="h-px bg-gray-50 my-0.5" />
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onDelete() }}
                        className="text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 w-full transition-colors"
                    >
                        <Trash2 size={13} className="text-red-500" />
                        Delete
                    </button>
                </div>
            )}
        </div>
    )
}

function SortableProjectItem({ project, activePath, children }: { project: any, activePath: string, children: React.ReactNode | ((isOver: boolean) => React.ReactNode) }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: project.id,
        data: { project, type: 'ProjectSortable', groupId: project.group_id || null }
    })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none'
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={clsx(
                "relative w-full cursor-grab active:cursor-grabbing",
                "hover:bg-gray-50/50"
            )}
        >
            {typeof children === 'function' ? children(false) : children}
        </div>
    )
}

function DroppableZone({ id, data, children, className, suppressHighlight }: { id: string, data?: any, children?: React.ReactNode, className?: string, suppressHighlight?: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id, data })

    return (
        <div
            ref={setNodeRef}
            className={clsx(
                className,
                "transition-all duration-200",
                isOver && !suppressHighlight && "bg-blue-600/10 ring-4 ring-blue-400/50 rounded-xl"
            )}
        >
            {children}
        </div>
    )
}

export function DroppableNavItem({ label, children, className }: { label: string, children: React.ReactNode | ((isOver: boolean) => React.ReactNode), className?: string }) {
    return (
        <div
            className={clsx(
                "transition-all duration-200",
                className
            )}
        >
            {typeof children === 'function' ? children(false) : children}
        </div>
    )
}

// --- Main Sidebar Component ---

export function Sidebar({ activePath, onItemClick }: SidebarProps) {
    const { data } = useAllTasks()
    const occurrencesMap = data?.occurrencesMap
    const allTasks = data?.tasks
    const { data: todayTasks } = useTasks({ type: 'today', includeSubtasks: true })
    const { data: tomorrowTasks } = useTasks({ type: 'tomorrow', includeSubtasks: true })
    const [projectOrder, setProjectOrder] = useState<Record<string, string[]>>(() => {
        try {
            const raw = localStorage.getItem('pulse_project_order')
            return raw ? JSON.parse(raw) : {}
        } catch {
            return {}
        }
    })
    const [habitOrder, setHabitOrder] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem('pulse_habit_order')
            return raw ? JSON.parse(raw) : []
        } catch {
            return []
        }
    })
    const [isProjectDragging, setIsProjectDragging] = useState(false)

    // Calculate Counts for recurring tasks support
    const getCount = (mode: 'today' | 'tomorrow') => {
        const tasksForMode = mode === 'today' ? todayTasks : tomorrowTasks
        if (!tasksForMode) return 0

        const targetDate = new Date()
        const localDate = new Date(targetDate.getTime() - (targetDate.getTimezoneOffset() * 60000))
        if (mode === 'tomorrow') {
            localDate.setDate(localDate.getDate() + 1)
        }
        const dateStr = localDate.toISOString().split('T')[0]
        if (!occurrencesMap) return tasksForMode.length

        const expanded = expandTasksForDate(tasksForMode, dateStr, occurrencesMap, mode)
        return expanded.active.length
    }

    const { data: projects, isError: projectsError, error: pError } = useProjects()
    if (projectsError) {
        console.error('Projects fetch error:', pError)
    }

    const { data: groups } = useProjectGroups()
    const { mutate: createGroup } = useCreateProjectGroup()
    const { mutate: createProject, isPending: isCreatingProject } = useCreateProject()
    const { mutate: updateProject } = useUpdateProject() // Using our optimistic update hook
    const { mutate: deleteGroup } = useDeleteProjectGroup()
    const { mutate: updateGroup } = useUpdateProjectGroup()
    const { mutate: deleteProject } = useDeleteProject()

    const { data: habits, isError: habitsError, error: hError } = useHabits()
    if (habitsError) {
        console.error('Habits fetch error:', hError)
    }
    const { mutate: createHabit, isPending: isHabitCreating } = useCreateHabit()
    const { mutate: updateHabit } = useUpdateHabit()
    const { mutate: deleteHabit } = useDeleteHabit()
    const { mutate: upsertHabitLog } = useUpsertHabitLog()
    const { mutate: deleteHabitLog } = useDeleteHabitLog()

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
    useEffect(() => {
        try {
            localStorage.setItem('pulse_project_order', JSON.stringify(projectOrder))
        } catch {
            // ignore
        }
    }, [projectOrder])

    useEffect(() => {
        if (!habits) return
        setHabitOrder(prev => {
            const existing = new Set(prev)
            const merged = [...prev]
            habits.forEach(habit => {
                if (!existing.has(habit.id)) {
                    merged.push(habit.id)
                }
            })
            const filtered = merged.filter(id => habits.some(habit => habit.id === id))
            try {
                localStorage.setItem('pulse_habit_order', JSON.stringify(filtered))
            } catch {
                // ignore
            }
            return filtered
        })
    }, [habits])

    const getOrderKey = (groupId?: string | null) => (groupId ? `group:${groupId}` : 'root')

    const getOrderedProjects = (list: any[] | undefined, key: string) => {
        if (!list) return []
        const order = projectOrder[key] || []
        const byId = new Map(list.map(p => [p.id, p]))
        const ordered = order.map(id => byId.get(id)).filter(Boolean) as any[]
        const missing = list.filter(p => !order.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name))
        return [...ordered, ...missing]
    }

    const getLocalDateStr = (date: Date) => {
        const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
        return local.toISOString().split('T')[0]
    }

    const todayStr = getLocalDateStr(new Date())
    const logsFromStr = getLocalDateStr(subDays(new Date(), 30))
    const { data: habitLogs } = useHabitLogs({ from: logsFromStr, to: todayStr })

    const orderedHabits = useMemo(() => {
        if (!habits) return []
        if (habitOrder.length === 0) {
            return [...habits].sort((a, b) => a.name.localeCompare(b.name))
        }
        const byId = new Map(habits.map(habit => [habit.id, habit]))
        const ordered = habitOrder.map(id => byId.get(id)).filter(Boolean) as Habit[]
        const missing = habits.filter(habit => !habitOrder.includes(habit.id)).sort((a, b) => a.name.localeCompare(b.name))
        return [...ordered, ...missing]
    }, [habits, habitOrder])

    const habitStats = useMemo(() => {
        if (!habitLogs) return new Map<string, { today?: string, todayLogId?: string, done7: number, streak: number }>()

        const byHabitDate = new Map<string, Map<string, { id: string, status: HabitLog['status'] }>>()
        habitLogs.forEach((log) => {
            if (!byHabitDate.has(log.habit_id)) {
                byHabitDate.set(log.habit_id, new Map())
            }
            byHabitDate.get(log.habit_id)!.set(log.log_date, { id: log.id, status: log.status })
        })

        const stats = new Map<string, { today?: string, todayLogId?: string, done7: number, streak: number }>()
        orderedHabits.forEach((habit) => {
            const logMap = byHabitDate.get(habit.id) || new Map()
            const todayLog = logMap.get(todayStr)
            let done7 = 0
            let streak = 0

            for (let i = 0; i < 7; i += 1) {
                const dayStr = getLocalDateStr(subDays(new Date(), i))
                if (logMap.get(dayStr)?.status === 'done') {
                    done7 += 1
                }
            }

            for (let i = 0; i < 31; i += 1) {
                const dayStr = getLocalDateStr(subDays(new Date(), i))
                if (logMap.get(dayStr)?.status === 'done') {
                    streak += 1
                } else {
                    break
                }
            }

            stats.set(habit.id, {
                today: todayLog?.status,
                todayLogId: todayLog?.id,
                done7,
                streak
            })
        })

        return stats
    }, [habitLogs, orderedHabits, todayStr, logsFromStr])

    useDndMonitor({
        onDragStart: (event) => {
            const activeData = event.active.data.current
            if (activeData?.type === 'ProjectSortable') {
                setIsProjectDragging(true)
            }
        },
        onDragEnd: (event) => {
            setIsProjectDragging(false)
            const { active, over } = event
            if (!over) return
            const activeData = active.data.current
            const overData = over.data.current
            if (activeData?.type !== 'ProjectSortable' || overData?.type !== 'ProjectSortable') return

            const groupId = activeData.groupId || null
            if ((overData.groupId || null) !== groupId) return

            const key = getOrderKey(groupId)
            const currentProjects = groupId
                ? projects?.filter(p => p.group_id === groupId)
                : projects?.filter(p => !p.group_id)
            const orderedProjects = getOrderedProjects(currentProjects, key)
            const ids = orderedProjects.map(p => p.id)
            const oldIndex = ids.indexOf(active.id)
            const newIndex = ids.indexOf(over.id)
            if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
            const newIds = arrayMove(ids, oldIndex, newIndex)
            setProjectOrder(prev => ({ ...prev, [key]: newIds }))
        },
        onDragCancel: () => {
            setIsProjectDragging(false)
        }
    })

    // Create Project State
    const [isCreatingProjectIn, setIsCreatingProjectIn] = useState<string | null>(null) // 'ungrouped' or groupId
    const [newProjectName, setNewProjectName] = useState("")
    const [isProjectsExpanded, setIsProjectsExpanded] = useState(false)
    const [isHabitsExpanded, setIsHabitsExpanded] = useState(false)
    const [isCreatingHabit, setIsCreatingHabit] = useState(false)
    const [newHabitName, setNewHabitName] = useState("")
    const [isTagsExpanded, setIsTagsExpanded] = useState(false)
    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null)
    const [iconPickerState, setIconPickerState] = useState<{ projectId: string, top: number, left: number, currentIcon: string | null } | null>(null)

    const { data: tags } = useTags()

    const navigate = useNavigate()
    const menuRef = useRef<HTMLDivElement>(null)

    // Close menu when clicking outside (kept if we re-add menus, but currently simplied)
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                // setProjectMenuOpen(null) 
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const toggleGroup = (groupId: string) => {
        setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
    }

    const handleCreateGroup = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const name = window.prompt("Enter folder name:")
        if (name && name.trim()) {
            createGroup({ name: name.trim(), userId: user.id })
        }
    }

    const handleRenameGroup = (group: any) => {
        const newName = window.prompt("Rename folder:", group.name)
        if (newName && newName.trim()) {
            updateGroup({ id: group.id, updates: { name: newName.trim() } })
        }
    }

    const handleDeleteGroup = (groupId: string) => {
        if (confirm("Delete this folder? Projects inside will be moved to Inbox.")) {
            deleteGroup(groupId)
        }
    }

    // Project Creation Logic
    const startCreatingProject = (location: string) => {
        setIsCreatingProjectIn(location)
        // If it's a closed group, open it
        if (location !== 'ungrouped' && collapsedGroups[location]) {
            toggleGroup(location)
        }
    }

    const handleCreateProjectSubmit = async (e: React.FormEvent, groupId: string | undefined) => {
        e.preventDefault()
        if (!newProjectName.trim()) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        createProject({ name: newProjectName, userId: user.id, groupId }, {
            onSuccess: (project) => {
                setIsCreatingProjectIn(null)
                setNewProjectName("")
                navigate(`/projects/${project.id}`)
            }
        })
    }

    const handleRenameProject = (project: any) => {
        const newName = window.prompt("Rename Project:", project.name)
        if (newName && newName.trim()) {
            updateProject({ projectId: project.id, updates: { name: newName.trim() } })
        }
    }

    const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault()
        e.stopPropagation()
        if (confirm("Move this project to Trash?")) {
            deleteProject(projectId)
        }
    }

    const startCreatingHabit = () => {
        setIsHabitsExpanded(true)
        setIsCreatingHabit(true)
    }

    const handleCreateHabitSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newHabitName.trim()) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        createHabit({ name: newHabitName.trim(), userId: user.id }, {
            onSuccess: (habit) => {
                setIsCreatingHabit(false)
                setNewHabitName("")
                setHabitOrder(prev => {
                    const updated = [...prev, habit.id]
                    try {
                        localStorage.setItem('pulse_habit_order', JSON.stringify(updated))
                    } catch {
                        // ignore
                    }
                    return updated
                })
            }
        })
    }

    const handleRenameHabit = (habit: Habit) => {
        const newName = window.prompt("Rename Habit:", habit.name)
        if (newName && newName.trim()) {
            updateHabit({ habitId: habit.id, updates: { name: newName.trim() } })
        }
    }

    const handleDeleteHabit = (habit: Habit) => {
        if (confirm("Archive this habit?")) {
            deleteHabit(habit.id, {
                onSuccess: () => {
                    setHabitOrder(prev => {
                        const updated = prev.filter(id => id !== habit.id)
                        try {
                            localStorage.setItem('pulse_habit_order', JSON.stringify(updated))
                        } catch {
                            // ignore
                        }
                        return updated
                    })
                }
            })
        }
    }

    const handleToggleHabitToday = async (habit: Habit) => {
        const stats = habitStats.get(habit.id)
        if (stats?.today === 'done' && stats.todayLogId) {
            deleteHabitLog(stats.todayLogId)
            return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        upsertHabitLog({
            habitId: habit.id,
            userId: user.id,
            logDate: todayStr,
            status: 'done'
        })
    }

    const handleOpenIconPicker = (e: React.MouseEvent, project: any) => {
        const rect = e.currentTarget.getBoundingClientRect()
        // Adjust position to be near the click
        setIconPickerState({ projectId: project.id, top: rect.bottom, left: rect.left, currentIcon: project.icon })
    }

    const handleIconSelect = (iconName: string) => {
        if (iconPickerState) {
            updateProject({ projectId: iconPickerState.projectId, updates: { icon: iconName } })
            setIconPickerState(null)
        }
    }

    const renderProjectItem = (project: any) => {
        const isActive = activePath === `/projects/${project.id}`
        const ProjectIcon = getProjectIcon(project.icon)
        return (
            <SortableProjectItem key={project.id} project={project} activePath={activePath}>
                <div className="relative group/project">
                    <Link
                        to={`/projects/${project.id}`}
                        onClick={onItemClick}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1 transition-colors text-sm",
                            isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-600",
                            "font-medium"
                        )}
                    >
                        <ProjectIcon size={16} />
                        <span className="whitespace-nowrap truncate flex-1 leading-none pb-0.5">
                            {project.name}
                        </span>

                        <ProjectActionsMenu
                            project={project}
                            onRename={handleRenameProject}
                            onDelete={handleDeleteProject}
                            onChangeIcon={(e: React.MouseEvent) => handleOpenIconPicker(e, project)}
                            isOver={false}
                            groups={groups}
                            onMoveToGroup={(groupId: string | null) => updateProject({ projectId: project.id, updates: { group_id: groupId } })}
                            onCreateGroup={handleCreateGroup}
                        />
                    </Link>
                </div>
            </SortableProjectItem>
        )
    }

    const navItems = [
        { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, droppable: false },
        {
            label: "Inbox",
            path: "/inbox",
            icon: Inbox,
            count: allTasks?.filter(t => !t.is_completed && !t.project_id).length,
            droppable: true
        },
        {
            label: "Today",
            path: "/today",
            icon: Sun,
            count: getCount('today'),
            droppable: false
        },
        {
            label: "Tomorrow",
            path: "/tomorrow",
            icon: Sunrise, // Distinct icon for Tomorrow
            count: getCount('tomorrow'),
            droppable: false
        },
        { label: "Calendar", path: "/calendar", icon: Calendar, droppable: false },
        { label: "Completed", path: "/completed", icon: CheckSquare, droppable: false },
    ]

    return (
        <div className="space-y-1 overflow-x-hidden">


            {/* Main Navigation */}
            <div className="space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activePath === item.path

                    const renderLink = (isOver: boolean = false) => (
                        <Link
                            to={item.path}
                            onClick={onItemClick}
                            className={clsx(
                                "flex items-center gap-3 px-4 py-1.5 transition-colors",
                                isOver ? "text-white" : (isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-600")
                            )}
                        >
                            <Icon size={20} />
                            <span className="whitespace-nowrap font-semibold flex-1">
                                {item.label}
                            </span>
                            {!!item.count && item.count > 0 && (
                                <span className={clsx("text-xs font-medium", isOver ? "text-blue-100" : "text-gray-400")}>
                                    {item.count}
                                </span>
                            )}
                        </Link>
                    )

                    if (item.droppable) {
                        return (
                            <DroppableNavItem key={item.path} label={item.label} className="w-full hover:bg-gray-50/50 border-l-4 border-transparent">
                                {(isOver) => renderLink(isOver)}
                            </DroppableNavItem>
                        )
                    }

                    return (
                        <div key={item.path} className="border-l-4 border-transparent w-full hover:bg-gray-50/50 transition-colors">
                            {renderLink()}
                        </div>
                    )
                })}
            </div>

            {/* Category Icons Row */}
            <div className="px-4 py-3 border-t border-gray-100 mt-2 flex justify-between items-center relative gap-1">
                {CATEGORIES.map(category => {
                    const CatIcon = category.icon
                    const isActive = activeCategory === category.id
                    const categoryTags = tags?.filter(t => t.category === category.id) || []

                    return (
                        <div key={category.id} className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (isActive) {
                                        setActiveCategory(null)
                                    } else {
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        setMenuPosition({ top: rect.bottom, left: rect.left })
                                        setActiveCategory(category.id)
                                    }
                                }}
                                className={clsx(
                                    "p-2 rounded-lg transition-colors",
                                    isActive ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                                )}
                                title={category.label}
                            >
                                <CatIcon size={18} />
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* Icon Picker Portal */}
            {iconPickerState && (
                <ProjectIconPicker
                    currentIcon={iconPickerState.currentIcon}
                    onSelect={handleIconSelect}
                    onClose={() => setIconPickerState(null)}
                    position={{ top: iconPickerState.top, left: iconPickerState.left }}
                />
            )}

            {/* Portal for Dropdown */}
            {activeCategory && menuPosition && createPortal(
                <div
                    className="fixed inset-0 z-[100] bg-transparent"
                    onClick={() => setActiveCategory(null)}
                >
                    <div
                        className="absolute bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 w-48"
                        style={{
                            top: menuPosition.top + 8,
                            left: menuPosition.left
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {CATEGORIES.find(c => c.id === activeCategory)?.label}
                        </div>
                        <div className="max-h-64 overflow-y-auto py-1">
                            {tags?.filter(t => t.category === activeCategory).length! > 0 ? (
                                tags?.filter(t => t.category === activeCategory).map(tag => (
                                    <Link
                                        key={tag.id}
                                        to={`/tags/${tag.id}`}
                                        onClick={() => {
                                            setActiveCategory(null)
                                            if (onItemClick) onItemClick()
                                        }}
                                        className={clsx(
                                            "flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors",
                                            activePath === `/tags/${tag.id}` ? "text-blue-600 bg-blue-50/50" : "text-gray-700"
                                        )}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                        <span className="truncate">{tag.name}</span>
                                    </Link>
                                ))
                            ) : (
                                <div className="px-3 py-2 text-xs text-gray-400 italic text-center">
                                    No tags
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="mt-12 space-y-0.5">

                {/* Header with Actions */}
                <div className="px-3 flex items-center justify-between group/main-header mb-1">
                    <button
                        onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                        className="flex items-center gap-1.5 focus:outline-none group/title"
                    >
                        <ChevronRight
                            size={14}
                            className={clsx("text-gray-400 transition-transform duration-200", isProjectsExpanded && "rotate-90")}
                        />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest group-hover/title:text-gray-600 transition-colors">
                            Projects
                        </span>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover/main-header:opacity-100 transition-opacity">
                        <button
                            onClick={() => startCreatingProject('ungrouped')}
                            className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-gray-100 transition-colors"
                            title="New Project"
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            onClick={handleCreateGroup}
                            className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-gray-100 transition-colors"
                            title="New Folder"
                        >
                            <FolderPlus size={16} />
                        </button>
                    </div>
                </div>


                {/* Content List */}
                {isProjectsExpanded && (
                    <div className="space-y-1">
                        {/* 1. Groups */}
                        {groups?.map(group => {
                            const groupProjects = projects?.filter(p => p.group_id === group.id)
                            const isCollapsed = collapsedGroups[group.id]

                            return (
                                <DroppableZone
                                    key={group.id}
                                    id={group.id}
                                    data={{ type: 'Folder', group }}
                                    suppressHighlight={isProjectDragging}
                                    className={clsx(
                                        "transition-all duration-200"
                                    )}
                                >
                                    <div className={clsx(
                                        "group/header relative border-l-4 border-transparent transition-all",
                                        "rounded-r-lg"
                                    )}>
                                        <div className="px-3 mb-1 flex items-center justify-between group/title">
                                            <button
                                                onClick={() => toggleGroup(group.id)}
                                                className="flex items-center gap-1 text-sm font-bold text-gray-700 hover:text-gray-900 outline-none flex-1 truncate py-1"
                                            >
                                                <ChevronRight
                                                    size={16}
                                                    className={clsx("text-gray-400 transition-transform duration-200", !isCollapsed && "rotate-90")}
                                                />
                                                <span className="truncate">{group.name}</span>
                                            </button>

                                            {/* Group Actions */}
                                            <GroupActionsMenu
                                                group={group}
                                                onAddProject={() => startCreatingProject(group.id)}
                                                onRename={() => handleRenameGroup(group)}
                                                onDelete={() => handleDeleteGroup(group.id)}
                                            />
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <div className="pl-6 space-y-0.5 min-h-[10px]">
                                            {isCreatingProjectIn === group.id && (
                                                <form onSubmit={(e) => handleCreateProjectSubmit(e, group.id)} className="px-3 py-1 mb-1">
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={newProjectName}
                                                        onChange={(e) => setNewProjectName(e.target.value)}
                                                        onBlur={() => !newProjectName && setIsCreatingProjectIn(null)}
                                                        placeholder="Project Name..."
                                                        disabled={isCreatingProject}
                                                        className="w-full py-1 px-2 text-sm bg-gray-50 border border-blue-200 rounded focus:border-blue-500 focus:outline-none"
                                                    />
                                                </form>
                                            )}

                                            {(() => {
                                                const ordered = getOrderedProjects(groupProjects, getOrderKey(group.id))
                                                return (
                                                    <SortableContext items={ordered.map(p => p.id)} strategy={verticalListSortingStrategy}>
                                                        {ordered.map(renderProjectItem)}
                                                    </SortableContext>
                                                )
                                            })()}
                                            {groupProjects?.length === 0 && !isCreatingProjectIn && (
                                                <div className="px-3 py-2 text-xs text-gray-300 italic text-center border-2 border-dashed border-gray-100 rounded-lg mx-2">
                                                    Drop projects here
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </DroppableZone>
                            )
                        })}

                        {/* 2. Ungrouped (Root) Projects */}
                        <DroppableZone id="projects-root" data={{ type: 'Folder', root: true }} suppressHighlight={isProjectDragging} className="space-y-0.5 min-h-[50px]">
                            {isCreatingProjectIn === 'ungrouped' && (
                                <form onSubmit={(e) => handleCreateProjectSubmit(e, undefined)} className="px-3 py-1 mb-1">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        onBlur={() => !newProjectName && setIsCreatingProjectIn(null)}
                                        placeholder="Project Name..."
                                        disabled={isCreatingProject}
                                        className="w-full py-1 px-2 text-sm bg-gray-50 border border-blue-200 rounded focus:border-blue-500 focus:outline-none"
                                    />
                                </form>
                            )}

                            {(() => {
                                const rootProjects = projects?.filter(p => !p.group_id)
                                const ordered = getOrderedProjects(rootProjects, getOrderKey(null))
                                return (
                                    <SortableContext items={ordered.map(p => p.id)} strategy={verticalListSortingStrategy}>
                                        {ordered.map(renderProjectItem)}
                                    </SortableContext>
                                )
                            })()}

                            {/* Empty state hint only if absolutely nothing exists */}
                            {projects?.length === 0 && groups?.length === 0 && !isCreatingProjectIn && (
                                <div className="px-3 py-4 text-xs text-gray-300 italic text-center">
                                    Create a project or folder
                                </div>
                            )}
                        </DroppableZone>
                    </div>
                )}

            </div>

            <div className="mt-8 space-y-0.5">
                <div className="px-3 flex items-center justify-between group/habits-header mb-1">
                    <button
                        onClick={() => setIsHabitsExpanded(!isHabitsExpanded)}
                        className="flex items-center gap-1.5 focus:outline-none group/title"
                    >
                        <ChevronRight
                            size={14}
                            className={clsx("text-gray-400 transition-transform duration-200", isHabitsExpanded && "rotate-90")}
                        />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest group-hover/title:text-gray-600 transition-colors">
                            Habits
                        </span>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover/habits-header:opacity-100 transition-opacity">
                        <button
                            onClick={startCreatingHabit}
                            className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-gray-100 transition-colors"
                            title="New Habit"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>

                {isHabitsExpanded && (
                    <div className="space-y-1">
                        {isCreatingHabit && (
                            <form onSubmit={handleCreateHabitSubmit} className="px-3 py-1 mb-1">
                                <input
                                    autoFocus
                                    type="text"
                                    value={newHabitName}
                                    onChange={(e) => setNewHabitName(e.target.value)}
                                    onBlur={() => !newHabitName && setIsCreatingHabit(false)}
                                    placeholder="Habit name..."
                                    disabled={isHabitCreating}
                                    className="w-full py-1 px-2 text-sm bg-gray-50 border border-blue-200 rounded focus:border-blue-500 focus:outline-none"
                                />
                            </form>
                        )}

                        {orderedHabits.map((habit) => (
                            <div
                                key={habit.id}
                                className="group/habit flex items-center gap-2 px-3 py-1 text-sm text-gray-600 rounded hover:bg-gray-50 transition-colors"
                            >
                                <button
                                    onClick={() => handleToggleHabitToday(habit)}
                                    className={clsx(
                                        "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                        habitStats.get(habit.id)?.today === 'done'
                                            ? "bg-emerald-500 border-emerald-500 text-white"
                                            : "border-gray-300 text-transparent hover:border-emerald-400"
                                    )}
                                    title="Mark done today"
                                >
                                    <Check size={12} />
                                </button>
                                {habit.emoji ? (
                                    <span className="text-base">{habit.emoji}</span>
                                ) : (
                                    <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: habit.color || "#93c5fd" }}
                                    />
                                )}
                                <Link
                                    to={`/habits/${habit.id}`}
                                    onClick={onItemClick}
                                    className={clsx(
                                        "truncate flex-1",
                                        activePath === `/habits/${habit.id}` ? "text-blue-600" : "text-gray-600"
                                    )}
                                >
                                    {habit.name}
                                </Link>
                                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                    {habitStats.get(habit.id)?.done7 || 0}/7
                                </span>
                                {habitStats.get(habit.id)?.streak ? (
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                        streak {habitStats.get(habit.id)?.streak}
                                    </span>
                                ) : null}
                                <button
                                    onClick={() => handleRenameHabit(habit)}
                                    className="opacity-0 group-hover/habit:opacity-100 text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100 transition-colors"
                                    title="Rename Habit"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => handleDeleteHabit(habit)}
                                    className="opacity-0 group-hover/habit:opacity-100 text-gray-400 hover:text-red-600 p-1 rounded hover:bg-gray-100 transition-colors"
                                    title="Archive Habit"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}

                        {orderedHabits.length === 0 && !isCreatingHabit && (
                            <div className="px-3 py-4 text-xs text-gray-300 italic text-center">
                                Create a habit
                            </div>
                        )}
                    </div>
                )}
            </div>


        </div>
    )
}
