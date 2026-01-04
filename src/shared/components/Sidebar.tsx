import { useNavigate, Link } from "react-router-dom"
import { Folder, ChevronRight, FolderPlus, Trash2, Edit2, Plus } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import clsx from "clsx"
import { useProjects } from "@/hooks/useProjects"
import { useProjectGroups, useCreateProjectGroup, useDeleteProjectGroup, useUpdateProjectGroup } from "@/hooks/useProjectGroups"
import { useCreateProject } from "@/hooks/useCreateProject"
import { useUpdateProject } from "@/hooks/useUpdateProject"
import { supabase } from "@/lib/supabase"
import { DndContext, useDraggable, useDroppable, type DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

type SidebarProps = {
    activePath: string
}

// --- DND Components ---

function DraggableProject({ project, activePath, children }: { project: any, activePath: string, children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: project.id,
        data: { project }
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none'
    }

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            {children}
        </div>
    )
}

function DroppableZone({ id, children, className }: { id: string, children?: React.ReactNode, className?: string }) {
    const { setNodeRef, isOver } = useDroppable({ id })

    return (
        <div ref={setNodeRef} className={clsx(className, isOver && "bg-blue-50/50 ring-2 ring-blue-100 rounded-lg")}>
            {children}
        </div>
    )
}

// --- Main Sidebar Component ---

export function Sidebar({ activePath }: SidebarProps) {
    const { data: projects } = useProjects()
    const { data: groups } = useProjectGroups()
    const { mutate: createGroup } = useCreateProjectGroup()
    const { mutate: createProject, isPending: isCreatingProject } = useCreateProject()
    const { mutate: updateProject } = useUpdateProject() // Using our optimistic update hook
    const { mutate: deleteGroup } = useDeleteProjectGroup()
    const { mutate: updateGroup } = useUpdateProjectGroup()

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
    const [activeDragId, setActiveDragId] = useState<string | null>(null)

    // Create Project State
    const [isCreatingProjectIn, setIsCreatingProjectIn] = useState<string | null>(null) // 'ungrouped' or groupId
    const [newProjectName, setNewProjectName] = useState("")

    const navigate = useNavigate()
    const menuRef = useRef<HTMLDivElement>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

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


    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        setActiveDragId(null)

        if (!over) return

        const projectId = active.id as string
        const targetId = over.id as string // groupId or 'inbox'

        const project = projects?.find(p => p.id === projectId)
        if (!project) return

        // If dropped on 'inbox', group_id -> null
        if (targetId === 'inbox') {
            if (project.group_id !== null) {
                updateProject({ projectId, updates: { group_id: null } })
            }
        }
        // If dropped on a group, group_id -> targetId
        else {
            // Verify targetId is actually a group
            const group = groups?.find(g => g.id === targetId)
            if (group && project.group_id !== group.id) {
                updateProject({ projectId, updates: { group_id: group.id } })
            }
        }
    }

    const renderProjectItem = (project: any) => (
        <DraggableProject key={project.id} project={project} activePath={activePath}>
            <div className="relative group/project mb-1">
                <Link
                    to={`/projects/${project.id}`}
                    className={clsx(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm text-gray-600 hover:bg-gray-100",
                        activePath === `/projects/${project.id}` && "bg-blue-50 text-blue-600"
                    )}
                >
                    <Folder size={16} />
                    <span className="whitespace-nowrap truncate flex-1 leading-none pb-0.5">
                        {project.name}
                    </span>
                </Link>
            </div>
        </DraggableProject>
    )

    return (
        <DndContext sensors={sensors} onDragStart={({ active }) => setActiveDragId(active.id as string)} onDragEnd={handleDragEnd}>
            <div className="mt-6 space-y-6">

                {/* Header with Actions */}
                <div className="px-3 flex items-center justify-between group/main-header">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Projects
                    </span>
                    <div className="flex items-center gap-1 opacity-100 transition-opacity">
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
                <div className="space-y-4">
                    {/* 1. Groups */}
                    {groups?.map(group => {
                        const groupProjects = projects?.filter(p => p.group_id === group.id)
                        const isCollapsed = collapsedGroups[group.id]

                        return (
                            <DroppableZone key={group.id} id={group.id} className="transition-all">
                                <div className="group/header relative">
                                    <div className="px-3 mb-1 flex items-center justify-between group/title">
                                        <button
                                            onClick={() => toggleGroup(group.id)}
                                            className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 outline-none flex-1 truncate"
                                        >
                                            <ChevronRight
                                                size={16}
                                                className={clsx("text-gray-400 transition-transform duration-200", !isCollapsed && "rotate-90")}
                                            />
                                            <span className="truncate">{group.name}</span>
                                            <span className="text-xs text-gray-400 font-normal">({groupProjects?.length})</span>
                                        </button>

                                        {/* Group Actions */}
                                        <div className="opacity-0 group-hover/title:opacity-100 flex items-center gap-1 transition-opacity">
                                            <button
                                                onClick={() => startCreatingProject(group.id)}
                                                className="p-1 hover:bg-blue-50 text-blue-500 rounded"
                                                title="Add Project to Folder"
                                            >
                                                <Plus size={12} />
                                            </button>
                                            <button onClick={() => handleRenameGroup(group)} className="p-1 hover:bg-gray-200 rounded text-gray-500"><Edit2 size={12} /></button>
                                            <button onClick={() => handleDeleteGroup(group.id)} className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                </div>

                                {!isCollapsed && (
                                    <div className="pl-2 space-y-0.5 min-h-[10px]">
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

                                        {groupProjects?.map(renderProjectItem)}
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
                    <DroppableZone id="inbox" className="space-y-0.5 min-h-[50px]">
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

                        {projects?.filter(p => !p.group_id).map(renderProjectItem)}

                        {/* Empty state hint only if absolutely nothing exists */}
                        {projects?.length === 0 && groups?.length === 0 && !isCreatingProjectIn && (
                            <div className="px-3 py-4 text-xs text-gray-300 italic text-center">
                                Create a project or folder
                            </div>
                        )}
                    </DroppableZone>
                </div>

            </div>
        </DndContext>
    )
}
