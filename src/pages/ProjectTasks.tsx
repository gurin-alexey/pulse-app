import { useState, useEffect, useRef, useMemo } from "react"

import { useParams, useSearchParams } from "react-router-dom"
import { useTasks } from "@/hooks/useTasks"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { AlertCircle, Loader2, MoreHorizontal, Plus, Trash2, Pencil, ChevronRight, GripVertical } from "lucide-react"
import { CreateTaskInput } from "@/features/tasks/CreateTaskInput"
import { ViewOptions, type SortOption, type GroupOption } from "@/features/tasks/ViewOptions"
import { useTaskView } from "@/features/tasks/useTaskView"
import { useSections, useCreateSection, useDeleteSection, useUpdateSection } from "@/hooks/useSections"
import clsx from "clsx"
import { createPortal } from "react-dom"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { AnimatePresence, motion } from "framer-motion"
import {
    useDraggable,
    useDroppable,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
    useDndMonitor,
    defaultDropAnimationSideEffects,
    closestCorners
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskItem } from "@/features/tasks/TaskItem"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { generateRecurringInstances } from "@/utils/recurrence"

// Draggable Task Item Wrapper
// Sortable Task Item Wrapper
function SortableTaskItem({ task, depth, disabled, children }: { task: any, depth?: number, disabled?: boolean, children: (props: { listeners: any, attributes: any }) => React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
        disabled,
        data: {
            type: 'Task',
            task
        }
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 200 : 'auto',
        position: 'relative' as const,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className={clsx(
                "rounded-md transition-all",
                isDragging && "bg-blue-50/20 outline outline-2 outline-dashed outline-blue-300 -outline-offset-2"
            )}
        >
            <div className={isDragging ? "invisible" : ""}>
                {children({ listeners, attributes: {} })}
            </div>
        </div>
    )
}

// Droppable Container Wrapper
function DroppableContainer({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
    const { setNodeRef, isOver } = useDroppable({ id })

    return (
        <div ref={setNodeRef} className={clsx(className, isOver && "bg-blue-50/50 ring-2 ring-blue-100 rounded-lg transition-all")}>
            {children}
        </div>
    )
}

function SortableSection({ section, children }: { section: any, children: (props: { listeners: any, attributes: any }) => React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
        id: section.id,
        data: {
            type: 'Section',
            section
        }
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 200 : 'auto',
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            {children({ listeners, attributes: {} })}
        </div>
    )
}


import type { TaskFilter } from "@/hooks/useTasks"

// ... imports remain the same ...

import { useProjects } from "@/hooks/useProjects"

// ... imports remain the same ...

export function ProjectTasks({ mode }: { mode?: 'inbox' | 'today' | 'tomorrow' }) {
    const { projectId } = useParams<{ projectId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()

    // Data Hooks
    const { data: allProjects } = useProjects()



    // Determine filter
    const filter: TaskFilter = mode === 'inbox'
        ? { type: 'inbox', includeSubtasks: true }
        : (mode === 'today' || mode === 'tomorrow')
            ? { type: mode, includeSubtasks: true }
            : { type: 'project', projectId: projectId!, includeSubtasks: true }

    // Data Hooks
    const { data: tasks, isLoading: tasksLoading, isError: tasksError } = useTasks(filter)
    const { data: sections, isLoading: sectionsLoading } = useSections(projectId)

    // Derived State
    const currentProject = allProjects?.find(p => p.id === projectId)
    const pageTitle = mode === 'inbox'
        ? 'Inbox'
        : mode === 'today'
            ? 'Today'
            : mode === 'tomorrow'
                ? 'Tomorrow'
                : currentProject?.name || 'Tasks'

    const showSections = !mode // Only show sections for specific projects

    // Calculate target date for "Today"/"Tomorrow" views
    // This ensures we view the correct "day" in the date-grouped view logic
    const targetDate = useMemo(() => {
        if (mode === 'tomorrow') {
            const d = new Date()
            d.setDate(d.getDate() + 1)
            const local = new Date(d.getTime() - (d.getTimezoneOffset() * 60000))
            return local.toISOString().split('T')[0]
        }
        if (mode === 'today') {
            const d = new Date()
            const local = new Date(d.getTime() - (d.getTimezoneOffset() * 60000))
            return local.toISOString().split('T')[0]
        }
        return undefined
    }, [mode])

    // Data Hooks
    // Fetch occurrences for Today/Tomorrow to support Status check and generation
    const { data: occurrences } = useQuery({
        queryKey: ['task_occurrences', mode, targetDate],
        queryFn: async () => {
            if (!targetDate) return []
            const { data } = await supabase.from('task_occurrences').select('*').eq('original_date', targetDate)
            return data || []
        },
        enabled: (mode === 'today' || mode === 'tomorrow') && !!targetDate
    })

    // Mutation Hooks
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createSection } = useCreateSection()
    const { mutate: deleteSection } = useDeleteSection()
    const { mutate: updateSection } = useUpdateSection()


    // View State
    // ... State declarations remain ...
    const [sortBy, setSortBy] = useState<SortOption>('manual')
    const [groupBy, setGroupBy] = useState<GroupOption>((mode === 'today' || mode === 'tomorrow') ? 'date' : 'none')
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
    const [completedAccordionOpen, setCompletedAccordionOpen] = useState(false)
    const [isAddingSection, setIsAddingSection] = useState(false)
    const [newSectionName, setNewSectionName] = useState("")
    const [sectionMenuOpen, setSectionMenuOpen] = useState<string | null>(null)
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
    const [editingSectionName, setEditingSectionName] = useState("")
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
    const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null) // Track which section we are hovering
    const [currentDragDepth, setCurrentDragDepth] = useState<number | null>(null) // Visual depth for placeholder

    const [activeDragItem, setActiveDragItem] = useState<any | null>(null) // Track active drag item for Overlay
    const activeTaskId = searchParams.get('task')

    const isDesktop = useMediaQuery("(min-width: 768px)")
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

    useEffect(() => {
        setPortalTarget(document.getElementById('mobile-header-right'))
    }, [])

    // Initial load: collapse all sections by default if not set? 
    useEffect(() => {
        if (sections) {
            setCollapsedSections(prev => {
                const next = { ...prev }
                sections.forEach(s => {
                    if (next[s.id] === undefined) next[s.id] = true
                })
                return next
            })
        }
    }, [sections])

    // Local optimistic state
    const [localSections, setLocalSections] = useState<any[]>([])
    const [localTasks, setLocalTasks] = useState<any[]>([])
    const isMutatingRef = useRef(false)

    // Sync local state when raw data changes
    useEffect(() => {
        if (!isMutatingRef.current && sections) {
            setLocalSections([...sections].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)))
        }
    }, [sections])

    useEffect(() => {
        if (!isMutatingRef.current && tasks) {
            let processedTasks = [...tasks]

            // For Today/Tomorrow, we must expand recurring tasks
            if ((mode === 'today' || mode === 'tomorrow') && targetDate && occurrences) {
                const expanded: any[] = []

                // Create lookup map for occurrences
                const occurrencesMap = new Map()
                if (Array.isArray(occurrences)) {
                    occurrences.forEach((o: any) => {
                        occurrencesMap.set(`${o.task_id}_${o.original_date}`, o.status)
                    })
                }

                // Helper to check if task matches the target date
                // Tasks from useTasks are either due exactly today OR are recurring

                for (const task of tasks) {
                    if (task.recurrence_rule) {
                        try {
                            // Generate instance for target date
                            // We use expanded range to avoid edge-case exclusions at 00:00
                            const start = new Date(targetDate + 'T00:00:00')
                            start.setMinutes(-15) // small buffer

                            const end = new Date(targetDate + 'T23:59:59')
                            end.setMinutes(15)

                            // Correct signature: task, start, end, map
                            const instances = generateRecurringInstances(task, start, end, occurrencesMap)
                            if (instances.length > 0) {
                                expanded.push(...instances)
                            }

                            // Note: If generating instances returns empty, it means the recurrence doesn't occur today.
                            // So we don't add the master.
                        } catch (e) {
                            console.error('Error expanding task recurrence', task.id, e)
                        }
                    } else {
                        // Non-recurring: Match target date OR overdue (if today)
                        const d = task.due_date?.split('T')[0]
                        const isMatch = d === targetDate
                        const isOverdue = mode === 'today' && d && targetDate && d < targetDate && !task.is_completed

                        if (isMatch || isOverdue) {
                            expanded.push(task)
                        }
                    }
                }

                processedTasks = expanded
            } else if (mode === 'today' || mode === 'tomorrow') {
                // If occurrences not loaded yet, or if simple list needed?
                // Just use filtering by due_date for safety if recurrence expansion not ready
                // But better to wait/show loading? Or show raw?
                // Showing raw might show old recurring tasks.
                // We'll trust the filter.
                processedTasks = processedTasks.filter(t => {
                    const d = t.due_date?.split('T')[0]
                    const isMatch = d === targetDate
                    const isOverdue = mode === 'today' && d && targetDate && d < targetDate && !t.is_completed
                    return (isMatch || isOverdue) && !t.recurrence_rule
                })
            }

            setLocalTasks(processedTasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
        }
    }, [tasks, occurrences, mode, targetDate])

    // Derived tasks to use for rendering
    const activeTasks = localTasks.filter((t: any) => !t.is_completed)
    const completedTasks = localTasks.filter((t: any) => t.is_completed).sort((a, b) => {
        if (!a.completed_at && !b.completed_at) return 0
        if (!a.completed_at) return 1
        if (!b.completed_at) return -1
        return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    }) || []

    const [collapsedTaskIds, setCollapsedTaskIds] = useState<Record<string, boolean>>({})

    // Recursive flatten logic
    // We use a helper to get flattened list for a specific container (Main List or Section)
    const getFlattenedTasks = (containerSectionId: string | null) => {
        // Helper to check if a task is an orphan (parent not in active list)
        const isOrphan = (t: any) => t.parent_id && !activeTasks.find(p => p.id === t.parent_id)

        const buildTree = (parentId: string | null, depth: number): (typeof activeTasks[0] & { depth: number })[] => {
            const children = activeTasks
                .filter(t => t.parent_id === parentId) // Get direct children
                .sort((a, b) => {
                    if (sortBy === 'manual') {
                        const orderDiff = (a.sort_order || 0) - (b.sort_order || 0)
                        if (orderDiff !== 0) return orderDiff
                        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
                    } else if (sortBy === 'date_created') {
                        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime() // Newest first
                    } else if (sortBy === 'due_date') {
                        if (!a.due_date) return 1; if (!b.due_date) return -1
                        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                    } else if (sortBy === 'alphabetical') {
                        return (a.title || "").localeCompare(b.title || "")
                    }
                    return 0
                })

            if (children.length === 0) return []

            // If parent is collapsed (and not root), don't render children
            // Note: We check parentId. If parentId is not null, check if IT is collapsed.
            // Actually, the recursion call controls this. If we occupy the loop, we check if child is collapsed before recursing.

            return children.reduce((acc, child) => {
                const grandchildren = collapsedTaskIds[child.id] ? [] : buildTree(child.id, depth + 1)
                return [...acc, { ...child, depth }, ...grandchildren]
            }, [] as (typeof activeTasks[0] & { depth: number })[])
        }

        // Roots are items that:
        // 1. Have (parent_id === null OR are orphans)
        // 2. Either we are in a mode that ignores sections (Today/Inbox), OR we match the container section
        return activeTasks
            .filter(t => {
                const isRootNode = t.parent_id === null || isOrphan(t)
                if (!isRootNode) return false

                // If sections are disabled (Today/Inbox), show everything in the main list
                if (!showSections) return true

                // Otherwise strictly match the section (null for main list, id for others)
                return containerSectionId === null ? t.section_id === null : t.section_id === containerSectionId
            })
            .sort((a, b) => {
                if (sortBy === 'manual') {
                    const orderDiff = (a.sort_order || 0) - (b.sort_order || 0)
                    if (orderDiff !== 0) return orderDiff
                    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
                } else if (sortBy === 'date_created') {
                    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                } else if (sortBy === 'due_date') {
                    if (!a.due_date) return 1; if (!b.due_date) return -1
                    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                } else if (sortBy === 'alphabetical') {
                    return (a.title || "").localeCompare(b.title || "")
                }
                return 0
            })
            .reduce((acc, root) => {
                const children = collapsedTaskIds[root.id] ? [] : buildTree(root.id, 1)
                return [...acc, { ...root, depth: 0 }, ...children]
            }, [] as (typeof activeTasks[0] & { depth: number })[])
    }

    // Default sorted list for "Grouping" views
    const sortedActiveTasks = [...activeTasks].sort((a, b) => {
        const orderDiff = (a.sort_order || 0) - (b.sort_order || 0)
        if (orderDiff !== 0) return orderDiff
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    })

    // Special Logic: If we are modifying the view (grouping), some sections should remain as is
    // User requested "Section Future and Ideas" to remain
    const preservationKeywords = ['future', 'ideas', 'будущее', 'идеи', 'future', 'idea']

    // 1. Identify Sections to Preserve
    const preservedSectionIds = new Set(
        localSections
            .filter(s => preservationKeywords.some(k => s.name.toLowerCase().includes(k)))
            .map(s => s.id)
    )

    // 2. Split tasks
    const tasksToGroup = sortedActiveTasks.filter(t => !t.section_id || !preservedSectionIds.has(t.section_id))
    const tasksToPreserve = sortedActiveTasks.filter(t => t.section_id && preservedSectionIds.has(t.section_id))

    // 3. Get Standard Grouped View
    const groupedStandardTasks = useTaskView({ tasks: tasksToGroup, showCompleted: false, sortBy, groupBy, projects: allProjects, targetDate })

    // 4. Merge Preserved Sections as Groups
    const tasksForView = useMemo(() => {
        if (groupBy === 'none') return {} // Not used in this mode

        const result = { ...groupedStandardTasks }

        // Group preserved tasks by their section name
        const preservedGroups: Record<string, typeof tasksToPreserve> = {}

        tasksToPreserve.forEach(task => {
            const section = localSections.find(s => s.id === task.section_id)
            const groupName = section ? section.name : 'Other'
            if (!preservedGroups[groupName]) preservedGroups[groupName] = []
            preservedGroups[groupName].push(task)
        })

        // Sort tasks within these preserved groups (using original sort or manual)
        // And append to result
        Object.entries(preservedGroups).forEach(([name, tasks]) => {
            // We can re-use the hierarchy builder if needed, or just flat list
            // Let's use simple sort for now to match other logic
            tasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            result[name] = tasks
        })

        return result
    }, [groupedStandardTasks, tasksToPreserve, localSections, groupBy])
    const renderMode = groupBy === 'none' ? 'sections' : 'groups'

    const handleTaskClick = (taskId: string) => {
        setSearchParams({ task: taskId })
    }

    const toggleStatus = (e: React.MouseEvent, task: any) => {
        e.stopPropagation()
        updateTask({ taskId: task.id, updates: { is_completed: !task.is_completed } })
    }

    // Sensors - Removed (Using Global Layout Context)

    useDndMonitor({
        onDragStart: (event) => {
            setDragOverSectionId(null)
            if (event.active.data.current?.type === 'Task') {
                const t = event.active.data.current.task
                setActiveDragItem(t)
                setCurrentDragDepth(t.depth) // Start with current depth
            }
        },
        onDragOver: (event) => {
            const { active, over, delta } = event
            if (!over) {
                setDragOverSectionId(null)
                return
            }

            const activeTask = active.data.current?.task
            if (!activeTask) return

            // ... (keep existing section logic) ...
            let potentialSectionId: string | null = null
            if (over.id === 'main-list' || sections?.some((s: any) => s.id === over.id)) {
                potentialSectionId = over.id as string
            } else if (over.data.current?.type === 'Task') {
                const task = over.data.current.task
                potentialSectionId = task.section_id || 'main-list'
            }

            const currentSectionId = activeTask.section_id || 'main-list'

            if (potentialSectionId && potentialSectionId !== currentSectionId) {
                setDragOverSectionId(potentialSectionId)
            } else {
                setDragOverSectionId(null)
            }

            // Calculate Visual Depth for indentation feedback
            if (activeTask && over.data.current?.type === 'Task') {
                const items = getFlattenedTasks(activeTask.section_id)
                const activeIndex = items.findIndex((t: any) => t.id === active.id)

                if (activeIndex !== -1) {
                    const projectedDepth = Math.max(0, (items[activeIndex].depth) + Math.round(delta.x / 24))
                    setCurrentDragDepth(projectedDepth)
                }
            }
        },
        onDragEnd: (event) => {
            setActiveDragItem(null)
            setDragOverSectionId(null) // Reset highlight
            const { active, over, delta } = event
            if (!over) return

            const activeId = active.id as string
            const activeTask = active.data.current?.task
            const overId = over.id as string
            const overData = over.data.current

            // 0. Handle Section Reordering
            if (active.data.current?.type === 'Section') {
                const targetSectionId = overId as string

                if (activeId !== targetSectionId) {
                    const activeIndex = localSections.findIndex((s: any) => s.id === activeId)
                    const overIndex = localSections.findIndex((s: any) => s.id === targetSectionId)

                    if (activeIndex !== -1 && overIndex !== -1) {
                        // 1. Instant UI update
                        const newSections = arrayMove(localSections, activeIndex, overIndex)
                        setLocalSections(newSections)

                        // 2. Persistent update logic
                        const prevSection = newSections[overIndex - 1]
                        const nextSection = newSections[overIndex + 1]

                        let newOrder = 0
                        if (prevSection && nextSection) {
                            newOrder = (prevSection.order_index + nextSection.order_index) / 2
                        } else if (prevSection) {
                            newOrder = prevSection.order_index + 100
                        } else if (nextSection) {
                            newOrder = nextSection.order_index - 100
                        }

                        // 3. Mark as mutating
                        isMutatingRef.current = true
                        updateSection({ id: activeId, updates: { order_index: newOrder } }, {
                            onSettled: () => { isMutatingRef.current = false }
                        })
                    }
                }
                return
            }

            // 1. Handle Section Moving (Dropping on Container)
            const isSectionDrop = overId === 'main-list' || localSections?.some((s: any) => s.id === overId)

            if (activeTask && isSectionDrop) {
                const newSectionId = overId === 'main-list' ? null : overId
                // Only update if actually changing sections
                if (activeTask.section_id !== newSectionId) {
                    updateTask({
                        taskId: activeId,
                        updates: {
                            section_id: newSectionId,
                            parent_id: null, // Reset hierarchy when moving sections
                            sort_order: -new Date().getTime() // Move to top roughly
                        }
                    })
                }
                return
            }

            // 2. Handle Reordering / Reparenting (Task over Task)
            if (activeTask && over.data.current?.type === 'Task') {
                const overTask = over.data.current.task

                // Case A: Cross-Section Drop (Task -> Task in different section)
                if (activeTask.section_id !== overTask.section_id) {
                    // Reset to root (parent_id: null) as requested
                    let newSortOrder = overTask.sort_order - 1 // Insert above by default

                    updateTask({
                        taskId: activeId,
                        updates: {
                            section_id: overTask.section_id,
                            parent_id: null, // FORCE ROOT
                            sort_order: newSortOrder
                        }
                    })
                    return
                }

                // Case B: Same Section Reordering
                if (activeId === overId && Math.abs(delta.x) < 10) return

                // Determine Container
                const currentSectionId = activeTask.section_id
                const items = getFlattenedTasks(currentSectionId)

                const activeIndex = items.findIndex((t: any) => t.id === activeId)
                const overIndex = items.findIndex((t: any) => t.id === overId)

                if (activeIndex === -1 || overIndex === -1) return

                // 1. Resolve Sort Order BEFORE updating local state
                const projectedList = [...items]
                const [movedItem] = projectedList.splice(activeIndex, 1)
                projectedList.splice(overIndex, 0, movedItem)

                const prevItem = projectedList[overIndex - 1]
                const nextItem = projectedList[overIndex + 1]
                const maxDepth = prevItem ? prevItem.depth + 1 : 0
                const projectedDepth = Math.max(0, (items[activeIndex].depth) + Math.round(delta.x / 40))
                const finalDepth = Math.min(projectedDepth, maxDepth)

                let newParentId: string | null = null
                if (prevItem) {
                    if (finalDepth === prevItem.depth + 1) newParentId = prevItem.id
                    else if (finalDepth === prevItem.depth) newParentId = prevItem.parent_id
                    else {
                        const ancestor = projectedList.slice(0, overIndex).reverse().find((t: any) => t.depth === finalDepth - 1)
                        newParentId = ancestor ? ancestor.id : null
                    }
                }

                let prevSiblingOrder: number | null = null
                let nextSiblingOrder: number | null = null
                for (let i = overIndex - 1; i >= 0; i--) {
                    const t = projectedList[i]
                    if (t.id === newParentId) break
                    if (t.depth === finalDepth) { prevSiblingOrder = t.sort_order ?? 0; break }
                    if (t.depth < finalDepth) break
                }
                for (let i = overIndex + 1; i < projectedList.length; i++) {
                    const t = projectedList[i]
                    if (t.depth === finalDepth) { nextSiblingOrder = t.sort_order ?? 0; break }
                    if (t.depth < finalDepth) break
                }

                let newSortOrder = 0
                if (prevSiblingOrder !== null && nextSiblingOrder !== null) {
                    newSortOrder = (prevSiblingOrder + nextSiblingOrder) / 2
                } else if (prevSiblingOrder !== null) {
                    newSortOrder = prevSiblingOrder + 100
                } else if (nextSiblingOrder !== null) {
                    newSortOrder = nextSiblingOrder - 100
                } else {
                    newSortOrder = new Date().getTime()
                }

                // 2. Instant UI update
                const movingTask = { ...items[activeIndex], parent_id: newParentId, sort_order: newSortOrder }
                const otherTasks = localTasks.filter((t: any) => t.id !== activeId)
                const updatedTasks = [...otherTasks, movingTask].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                setLocalTasks(updatedTasks)

                // 3. Persistent update logic
                isMutatingRef.current = true
                updateTask({
                    taskId: activeId,
                    updates: {
                        parent_id: newParentId,
                        sort_order: newSortOrder
                    }
                }, { onSettled: () => { isMutatingRef.current = false } })
            }
        }
    })


    const toggleSection = (sectionId: string) => {
        setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))
    }

    // ... Section CRUD handlers ...
    const handleCreateSection = async (e: React.FormEvent) => {
        e.preventDefault(); if (!newSectionName.trim() || !projectId) return
        createSection({ projectId, name: newSectionName }); setNewSectionName(""); setIsAddingSection(false)
    }
    const handleRenameSection = async (e: React.FormEvent, sectionId: string) => {
        e.preventDefault(); if (!editingSectionName.trim()) return
        updateSection({ id: sectionId, updates: { name: editingSectionName } }); setEditingSectionId(null)
    }





    // ...

    // Swipe Logic for Indent/Outdent on Mobile
    const handleSwipeIndent = (task: any) => {
        // Can only indent if sorting is manual
        if (sortBy !== 'manual') return

        const currentSectionId = task.section_id
        const items = getFlattenedTasks(currentSectionId)
        const index = items.findIndex((t: any) => t.id === task.id)

        if (index <= 0) return // First item cannot be indented

        const prevItem = items[index - 1]

        // Optimistic update: Parent becomes prevItem
        updateTask({
            taskId: task.id,
            updates: {
                parent_id: prevItem.id
            }
        })

        // Expand previous item if it was collapsed
        if (collapsedTaskIds[prevItem.id]) {
            setCollapsedTaskIds(prev => ({ ...prev, [prevItem.id]: false }))
        }
    }

    const handleSwipeOutdent = (task: any) => {
        if (!task.parent_id) return // Already root

        const parentTask = activeTasks.find(t => t.id === task.parent_id)
        const newParentId = parentTask ? parentTask.parent_id : null

        updateTask({
            taskId: task.id,
            updates: {
                parent_id: newParentId
            }
        })
    }

    // Helper to render a single task item
    const renderTaskItem = (task: any, index?: number) => {
        const hasChildren = activeTasks.some(t => t.parent_id === task.id)
        const isDraggingThis = activeDragItem?.id === task.id
        const effectiveDepth = isDraggingThis && currentDragDepth !== null ? currentDragDepth : task.depth

        // Use a composite key if index is provided (for duplicates in Groups view), otherwise standard ID
        const uniqueKey = index !== undefined ? `${task.id}-${index}` : task.id

        return (
            <SortableTaskItem key={uniqueKey} task={task} depth={effectiveDepth} disabled={sortBy !== 'manual'}>
                {({ listeners, attributes }) => (
                    <TaskItem
                        task={task}
                        isActive={activeTaskId === task.id}
                        depth={task.depth} // Keep original depth for content (which is hidden during drag anyway)
                        listeners={listeners}
                        attributes={attributes}
                        hasChildren={hasChildren}
                        isCollapsed={!!collapsedTaskIds[task.id]}
                        onToggleCollapse={() => setCollapsedTaskIds(prev => ({ ...prev, [task.id]: !prev[task.id] }))}
                        onIndent={() => handleSwipeIndent(task)}
                        onOutdent={() => handleSwipeOutdent(task)}
                    />
                )}
            </SortableTaskItem>
        )
    }

    if (tasksLoading || sectionsLoading) return <div className="flex items-center justify-center h-full text-gray-400"><Loader2 className="animate-spin mr-2" />Loading...</div>
    if (tasksError) return <div className="flex items-center justify-center h-full text-red-500"><AlertCircle className="mr-2" />Error loading tasks</div>




    // Simplified Render: No DndContext, just children content. The Layout DndContext provides the context.
    return (
        <div className="h-full flex flex-col">
            {/* Mobile View Options Portal */}
            {!isDesktop && portalTarget && createPortal(
                <ViewOptions sortBy={sortBy} setSortBy={setSortBy} groupBy={groupBy} setGroupBy={setGroupBy} />,
                portalTarget
            )}

            <div className="px-4 py-3 border-b border-gray-100 hidden md:flex items-center gap-4 min-h-[4rem] shrink-0 sticky top-0 bg-white z-30">
                <h2 className="font-bold text-lg text-gray-800 shrink-0">{pageTitle}</h2>
                <div className="flex-1 max-w-2xl">
                    <CreateTaskInput projectId={projectId || null} defaultDueDate={targetDate} placeholder="Add a task..." />
                </div>
                <div className="shrink-0">
                    <ViewOptions sortBy={sortBy} setSortBy={setSortBy} groupBy={groupBy} setGroupBy={setGroupBy} />
                </div>
            </div>

            <div className="flex-1 pl-4 pr-0 pt-4 md:p-4 overflow-y-auto pb-20">
                {renderMode === 'groups' ? (
                    // Standard Grouped View (No Drag/Drop support needed here explicitly requested yet)
                    <div className="flex flex-col">
                        {/* Allow creating tasks in Inbox/Today even without projectId */}

                        {Object.entries(tasksForView).map(([groupName, groupTasks]) => {
                            // Filter out children of collapsed parents
                            const visibleTasks = []
                            let hiddenUntilDepth = null

                            for (const t of groupTasks) {
                                const task = t as any
                                if (hiddenUntilDepth !== null) {
                                    if (task.depth > hiddenUntilDepth) continue
                                    else hiddenUntilDepth = null
                                }

                                visibleTasks.push(task)

                                if (collapsedTaskIds[task.id]) {
                                    hiddenUntilDepth = task.depth
                                }
                            }

                            // Determine if this group is collapsed
                            // Logic: If user has explicitly toggled it, use that state.
                            // If not toggled yet (undefined), check if it matches "Future" or "Ideas" keywords to default to collapsed (true).
                            // Otherwise default to expanded (false).

                            const isDefaultCollapsed = ['future', 'ideas', 'будущее', 'идеи', 'future', 'idea'].some(k => groupName.toLowerCase().includes(k))
                            const isGroupCollapsed = collapsedGroups[groupName] !== undefined ? collapsedGroups[groupName] : isDefaultCollapsed

                            return (
                                <div key={groupName} className="mb-8">
                                    <button
                                        onClick={() => setCollapsedGroups(prev => ({ ...prev, [groupName]: !isGroupCollapsed }))}
                                        className="flex items-center gap-2 w-full text-left mb-2 group/header focus:outline-none"
                                    >
                                        <ChevronRight
                                            size={16}
                                            className={clsx("text-gray-400 transition-transform duration-200", !isGroupCollapsed && "rotate-90")}
                                        />
                                        <h3 className="text-sm font-bold text-gray-500 uppercase">{groupName} ({visibleTasks.length})</h3>
                                    </button>

                                    {!isGroupCollapsed && visibleTasks.map((task, index) => renderTaskItem(task, index))}
                                </div>
                            )
                        })}
                        {Object.keys(tasksForView).length === 0 && <div className="text-gray-400 text-center mt-10">No active tasks</div>}

                        {/* COMPLETED TASKS SECTION FOR GROUPS VIEW (Today/Tomorrow) */}
                        {completedTasks.length > 0 && (
                            <div className="mt-auto border-t border-gray-100 pt-6">
                                <button
                                    onClick={() => setCompletedAccordionOpen(!completedAccordionOpen)}
                                    className="flex items-center gap-2 text-gray-500 font-semibold text-sm hover:text-gray-700 transition-colors mb-4"
                                >
                                    <ChevronRight size={16} className={clsx("transition-transform", completedAccordionOpen && "rotate-90")} />
                                    Completed ({completedTasks.length})
                                </button>

                                <AnimatePresence>
                                    {completedAccordionOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-1">
                                                {completedTasks.map(task => (
                                                    <TaskItem
                                                        key={task.id}
                                                        task={task}
                                                        isActive={activeTaskId === task.id}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                ) : (
                    // SECTIONS VIEW with Drag & Drop
                    <div className="flex flex-col min-h-full">
                        {/* 1. Main List (Uncategorized) - Grows to fill space */}
                        <div className="flex-1 mb-8">
                            <DroppableContainer
                                id="main-list"
                                className={clsx(
                                    "min-h-[100px] transition-colors rounded-xl p-2 -mt-2 -mx-2",
                                    dragOverSectionId === 'main-list' && "bg-blue-50/60 ring-2 ring-blue-100"
                                )}
                            >


                                <SortableContext items={getFlattenedTasks(null).map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
                                    <div className="mt-4 space-y-2">
                                        {getFlattenedTasks(null).map(renderTaskItem)}
                                    </div>
                                </SortableContext>
                            </DroppableContainer>
                        </div>

                        {/* 2. Accordion Sections & Add Button - Pushed to Bottom */}
                        {showSections && (
                            <div className="mt-auto space-y-4 pt-10">
                                <SortableContext items={localSections.map((s: any) => s.id)} strategy={verticalListSortingStrategy}>
                                    {localSections.map((section: any) => {
                                        const sectionTasks = activeTasks.filter((t: any) => t.section_id === section.id)
                                        // Also sort these
                                        const sortedSectionTasks = [...sectionTasks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                        const isCollapsed = collapsedSections[section.id]

                                        return (
                                            <SortableSection key={section.id} section={section}>
                                                {({ listeners }) => (
                                                    <DroppableContainer
                                                        id={section.id}
                                                        className={clsx(
                                                            "group/section transition-all",
                                                            dragOverSectionId === section.id && "bg-blue-50/30 ring-2 ring-blue-100 rounded-lg"
                                                        )}
                                                    >
                                                        {/* Header */}
                                                        <div
                                                            className="flex items-center justify-between py-2 cursor-pointer select-none group/header"
                                                            onClick={() => toggleSection(section.id)}
                                                        >
                                                            <div className="flex-1 flex items-center gap-2">
                                                                <div {...listeners} className="p-1 text-gray-300 hover:text-gray-600 cursor-move opacity-0 group-hover/header:opacity-100 transition-opacity">
                                                                    <GripVertical size={14} />
                                                                </div>
                                                                <ChevronRight size={16} className={clsx("text-gray-400 transition-transform duration-200", !isCollapsed && "rotate-90")} />

                                                                {editingSectionId === section.id ? (
                                                                    <form onSubmit={(e) => handleRenameSection(e, section.id)} onClick={e => e.stopPropagation()}>
                                                                        <input autoFocus type="text" value={editingSectionName} onChange={e => setEditingSectionName(e.target.value)} onBlur={() => setEditingSectionId(null)} className="font-bold text-sm text-gray-800 bg-white px-1 rounded outline-none border border-blue-200" />
                                                                    </form>
                                                                ) : (
                                                                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400 flex items-center gap-2 whitespace-nowrap">
                                                                        {section.name}
                                                                        <span className="text-gray-300 font-normal normal-case">({sectionTasks?.length})</span>
                                                                    </h3>
                                                                )}

                                                                {/* Horizontal Line Separator */}
                                                                <div className="flex-1 h-px bg-gray-100" />
                                                            </div>

                                                            <div className="relative ml-2" onClick={e => e.stopPropagation()}>
                                                                <button onClick={() => setSectionMenuOpen(sectionMenuOpen === section.id ? null : section.id)} className="p-1 hover:bg-gray-100 rounded text-gray-400 opacity-0 group-hover/header:opacity-100 transition-opacity">
                                                                    <MoreHorizontal size={16} />
                                                                </button>
                                                                {sectionMenuOpen === section.id && (
                                                                    <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                                                                        <button onClick={() => { setEditingSectionId(section.id); setEditingSectionName(section.name); setSectionMenuOpen(null) }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2"><Pencil size={14} /> Rename</button>
                                                                        <button onClick={() => { if (confirm('Delete?')) deleteSection(section.id) }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Content */}
                                                        {!isCollapsed && (
                                                            <div className="py-2">
                                                                <SortableContext items={getFlattenedTasks(section.id).map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
                                                                    <div className="space-y-0.5 min-h-[20px]">
                                                                        {getFlattenedTasks(section.id).map(renderTaskItem)}
                                                                        {getFlattenedTasks(section.id).length === 0 && <div className="text-xs text-gray-300 p-4 text-center">Drop tasks here</div>}
                                                                    </div>
                                                                </SortableContext>
                                                                <div className="mt-2 border-t border-gray-50/50 pt-2">
                                                                    {projectId && (
                                                                        <div className="hidden md:block">
                                                                            <CreateTaskInput projectId={projectId} sectionId={section.id} placeholder="Add to section..." defaultDueDate={targetDate} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </DroppableContainer>
                                                )}
                                            </SortableSection>
                                        )
                                    })}
                                </SortableContext>

                                {/* Add Section Button */}
                                {isAddingSection ? (
                                    <form onSubmit={handleCreateSection} className="mt-4"><input autoFocus type="text" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} onBlur={() => { if (!newSectionName) setIsAddingSection(false) }} placeholder="Section Name..." className="font-bold text-sm text-gray-800 bg-white border border-blue-200 rounded px-3 py-2 w-full outline-none" /></form>
                                ) : (
                                    <button onClick={() => setIsAddingSection(true)} className="flex items-center gap-2 text-gray-400 hover:text-blue-600 font-semibold text-sm transition-colors p-2 -ml-2"><Plus size={16} /> Add Section</button>
                                )}
                            </div>
                        )}

                        {/* COMPLETED ACCORDION - Pushed to bottom */}
                        {completedTasks.length > 0 && (
                            <div className="mt-auto border-t border-gray-100 pt-6 pb-6 w-full">
                                <button
                                    onClick={() => setCompletedAccordionOpen(!completedAccordionOpen)}
                                    className="flex items-center gap-2 text-gray-500 font-semibold text-sm hover:text-gray-700 transition-colors mb-4"
                                >
                                    <ChevronRight size={16} className={clsx("transition-transform", completedAccordionOpen && "rotate-90")} />
                                    Completed ({completedTasks.length})
                                </button>

                                <AnimatePresence>
                                    {completedAccordionOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-1">
                                                {completedTasks.map(task => (
                                                    <TaskItem
                                                        key={task.id}
                                                        task={task}
                                                        isActive={activeTaskId === task.id}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/* Portal Overlay for smooth dragging across containers */}
        </div>
    )
}
