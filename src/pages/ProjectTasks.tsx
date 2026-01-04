import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { useTasks } from "@/hooks/useTasks"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { AlertCircle, Loader2, MoreHorizontal, Plus, Trash2, Pencil, ChevronRight } from "lucide-react"
import { CreateTaskInput } from "@/features/tasks/CreateTaskInput"
import { ViewOptions, type SortOption, type GroupOption } from "@/features/tasks/ViewOptions"
import { useTaskView } from "@/features/tasks/useTaskView"
import { useSections, useCreateSection, useDeleteSection, useUpdateSection } from "@/hooks/useSections"
import clsx from "clsx"
import { DndContext, useDraggable, useDroppable, type DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

// Draggable Task Item Wrapper
function DraggableTaskItem({ task, children }: { task: any, children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.id,
        data: { task }
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none' // Required for pointer events
    }

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            {children}
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


import type { TaskFilter } from "@/hooks/useTasks"

// ... imports remain the same ...

export function ProjectTasks({ mode }: { mode?: 'inbox' | 'today' }) {
    const { projectId } = useParams<{ projectId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()

    // Determine filter
    const filter: TaskFilter = mode === 'inbox'
        ? { type: 'inbox' }
        : mode === 'today'
            ? { type: 'today' }
            : { type: 'project', projectId: projectId! }

    // Data Hooks
    const { data: tasks, isLoading: tasksLoading, isError: tasksError } = useTasks(filter)
    const { data: sections, isLoading: sectionsLoading } = useSections(projectId)

    // Derived State
    const pageTitle = mode === 'inbox' ? 'Inbox' : mode === 'today' ? 'Today' : 'Tasks'
    const showSections = !mode // Only show sections for specific projects

    // Mutation Hooks
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: createSection } = useCreateSection()
    const { mutate: deleteSection } = useDeleteSection()
    const { mutate: updateSection } = useUpdateSection()

    // View State
    const [sortBy, setSortBy] = useState<SortOption>('date_created')
    const [groupBy, setGroupBy] = useState<GroupOption>('none')
    const [showCompleted, setShowCompleted] = useState(false)
    const [isAddingSection, setIsAddingSection] = useState(false)
    const [newSectionName, setNewSectionName] = useState("")
    const [sectionMenuOpen, setSectionMenuOpen] = useState<string | null>(null)
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
    const [editingSectionName, setEditingSectionName] = useState("")
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

    const activeTaskId = searchParams.get('task')

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


    const tasksForView = useTaskView({ tasks, showCompleted, sortBy, groupBy })
    const renderMode = groupBy === 'none' ? 'sections' : 'groups'

    const handleTaskClick = (taskId: string) => {
        setSearchParams({ task: taskId })
    }

    const toggleStatus = (e: React.MouseEvent, task: any) => {
        e.stopPropagation() // Prevent drag start if needed, but draggable handles.
        // Prevent click bubbling to draggable listeners? 
        // Actually button click is fine.
        updateTask({ taskId: task.id, updates: { is_completed: !task.is_completed } })
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (!over) return

        const taskId = active.id as string
        const targetContainerId = over.id as string // 'main-list' or sectionId

        // Optimistic update handled by hook usually, but here we just fire mutation
        if (targetContainerId === 'main-list') {
            updateTask({ taskId, updates: { section_id: null } })
        } else {
            updateTask({ taskId, updates: { section_id: targetContainerId } })
        }
    }

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

    // Helper to render a single task item
    const renderTaskItem = (task: any) => (
        <DraggableTaskItem key={task.id} task={task}>
            <div
                onClick={() => handleTaskClick(task.id)}
                className={clsx(
                    "flex items-center p-3 border rounded-lg transition-colors group cursor-pointer mb-2 bg-white",
                    activeTaskId === task.id ? "bg-blue-50 border-blue-200" : "border-gray-100 hover:bg-gray-50"
                )}
            >
                <input
                    type="checkbox"
                    checked={task.is_completed}
                    onChange={() => { }}
                    onClick={(e) => toggleStatus(e, task)}
                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className={clsx("font-medium truncate", task.is_completed ? "text-gray-400 line-through" : "text-gray-700")}>
                            {task.title}
                        </div>
                        <div className="flex items-center gap-1">
                            {task.tags?.map((tag: any) => (
                                <div key={tag.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} title={tag.name} />
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                        {task.due_date && (
                            <span className={clsx(
                                new Date(task.due_date) < new Date() && !task.is_completed ? "text-red-500 font-medium" : "text-gray-400"
                            )}>
                                {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                        )}
                        {task.start_time && (
                            <span className="text-gray-400">
                                {new Date(task.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </DraggableTaskItem>
    )

    if (tasksLoading || sectionsLoading) return <div className="flex items-center justify-center h-full text-gray-400"><Loader2 className="animate-spin mr-2" />Loading...</div>
    if (tasksError) return <div className="flex items-center justify-center h-full text-red-500"><AlertCircle className="mr-2" />Error loading tasks</div>

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="h-full flex flex-col">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between h-16 shrink-0 sticky top-0 bg-white z-10">
                    <h2 className="font-bold text-lg text-gray-800">{pageTitle}</h2>
                    <ViewOptions sortBy={sortBy} setSortBy={setSortBy} groupBy={groupBy} setGroupBy={setGroupBy} showCompleted={showCompleted} setShowCompleted={setShowCompleted} />
                </div>

                <div className="flex-1 p-4 overflow-y-auto pb-20">
                    {renderMode === 'groups' ? (
                        // Standard Grouped View (No Drag/Drop support needed here explicitly requested yet)
                        <div className="mt-4">
                            {/* Allow creating tasks in Inbox/Today even without projectId */}
                            <div className="mb-6"><CreateTaskInput projectId={projectId || null} /></div>

                            {Object.entries(tasksForView).map(([groupName, groupTasks]) => (
                                <div key={groupName} className="mb-8">
                                    <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase">{groupName} ({groupTasks.length})</h3>
                                    {groupTasks.map(renderTaskItem)}
                                </div>
                            ))}
                            {Object.keys(tasksForView).length === 0 && <div className="text-gray-400 text-center mt-10">No tasks match filter</div>}
                        </div>
                    ) : (
                        // SECTIONS VIEW with Drag & Drop
                        <div className="space-y-8">
                            {/* 1. Main List (Uncategorized) */}
                            <DroppableContainer id="main-list" className="min-h-[100px]">
                                {projectId ? (
                                    <CreateTaskInput projectId={projectId} sectionId={null} />
                                ) : (
                                    // For Inbox/Today, we don't need projectId if we handle it in API or pass null
                                    <CreateTaskInput projectId={projectId || null} sectionId={null} />
                                )}

                                <div className="mt-4 space-y-2">
                                    {tasks?.filter(t => !t.section_id && (!showCompleted ? !t.is_completed : true))
                                        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) // Simple sort
                                        .map(renderTaskItem)
                                    }
                                </div>
                            </DroppableContainer>

                            {/* 2. Accordion Sections - ONLY SHOW IF showSections is TRUE */}
                            {showSections && (
                                <div className="space-y-4">
                                    {sections?.map(section => {
                                        const sectionTasks = tasks?.filter(t => t.section_id === section.id && (!showCompleted ? !t.is_completed : true))
                                        const isCollapsed = collapsedSections[section.id]

                                        return (
                                            <DroppableContainer key={section.id} id={section.id} className="group/section border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                                                {/* Header */}
                                                <div
                                                    className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer select-none border-b border-gray-100"
                                                    onClick={() => toggleSection(section.id)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <ChevronRight size={16} className={clsx("text-gray-400 transition-transform duration-200", !isCollapsed && "rotate-90")} />
                                                        {editingSectionId === section.id ? (
                                                            <form onSubmit={(e) => handleRenameSection(e, section.id)} onClick={e => e.stopPropagation()}>
                                                                <input autoFocus type="text" value={editingSectionName} onChange={e => setEditingSectionName(e.target.value)} onBlur={() => setEditingSectionId(null)} className="font-bold text-sm text-gray-800 bg-white px-1 rounded outline-none border border-blue-200" />
                                                            </form>
                                                        ) : (
                                                            <h3 className="font-bold text-sm text-gray-800">{section.name} <span className="text-gray-400 font-normal ml-1">({sectionTasks?.length})</span></h3>
                                                        )}
                                                    </div>
                                                    <div className="relative" onClick={e => e.stopPropagation()}>
                                                        <button onClick={() => setSectionMenuOpen(sectionMenuOpen === section.id ? null : section.id)} className="p-1 hover:bg-gray-200 rounded text-gray-400"><MoreHorizontal size={16} /></button>
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
                                                    <div className="p-3 bg-gray-50/30">
                                                        <div className="space-y-0.5 min-h-[50px]">
                                                            {sectionTasks?.map(renderTaskItem)}
                                                            {sectionTasks?.length === 0 && <div className="text-xs text-gray-300 p-2 text-center">Drop tasks here</div>}
                                                        </div>
                                                        <div className="mt-3">
                                                            {projectId && <CreateTaskInput projectId={projectId} sectionId={section.id} placeholder="Add to section..." />}
                                                        </div>
                                                    </div>
                                                )}
                                            </DroppableContainer>
                                        )
                                    })}
                                </div>
                            )}

                            {/* 3. Add Section - ONLY SHOW IF showSections is TRUE */}
                            {showSections && (
                                isAddingSection ? (
                                    <form onSubmit={handleCreateSection} className="mt-4"><input autoFocus type="text" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} onBlur={() => { if (!newSectionName) setIsAddingSection(false) }} placeholder="Section Name..." className="font-bold text-sm text-gray-800 bg-white border border-blue-200 rounded px-3 py-2 w-full outline-none" /></form>
                                ) : (
                                    <button onClick={() => setIsAddingSection(true)} className="flex items-center gap-2 text-gray-400 hover:text-blue-600 font-semibold text-sm mt-8 transition-colors"><Plus size={16} /> Add Section</button>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DndContext>
    )
}
