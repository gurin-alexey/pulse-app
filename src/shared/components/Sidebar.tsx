import { useNavigate, Link } from "react-router-dom"
import { Folder, ChevronRight, FolderPlus, Trash2, Edit2, Plus, Calendar, LayoutDashboard, CheckSquare, Inbox, Sun, Tag as TagIcon, MoreHorizontal, Sunrise, RefreshCw } from "lucide-react"
import { useQueryClient, useIsFetching } from "@tanstack/react-query" // Import react-query hooks

// ... existing code ...

import { createPortal } from "react-dom"
import { useState, useRef, useEffect } from "react"
import clsx from "clsx"
import { useProjects } from "@/hooks/useProjects"
import { useProjectGroups, useCreateProjectGroup, useDeleteProjectGroup, useUpdateProjectGroup } from "@/hooks/useProjectGroups"
import { useCreateProject } from "@/hooks/useCreateProject"
import { useUpdateProject } from "@/hooks/useUpdateProject"
import { supabase } from "@/lib/supabase"
import { useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useDeleteProject } from "@/hooks/useDeleteProject"
import { useAllTasks } from "@/hooks/useAllTasks"
import { useTags } from "@/hooks/useTags"
import { isToday, isTomorrow, parseISO } from "date-fns"
import { CATEGORIES } from "@/constants/categories"

type SidebarProps = {
    activePath: string
    onItemClick?: () => void
}

// --- DND Components ---

function ProjectActionsMenu({ project, onRename, onDelete, isOver }: any) {
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
                    "opacity-0 group-hover/project:opacity-100 p-1 rounded transition-all",
                    isOpen && "opacity-100 bg-gray-100/20",
                    isOver ? "text-blue-100 hover:bg-white/20 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                )}
                title="Project Settings"
            >
                <MoreHorizontal size={16} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 shadow-xl rounded-md z-50 py-1 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onRename(project) }}
                        className="text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 w-full transition-colors"
                    >
                        <Edit2 size={13} className="text-gray-400" />
                        Rename
                    </button>
                    <div className="h-px bg-gray-50 my-0.5" />
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onDelete(e, project.id) }}
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

function DraggableProject({ project, activePath, children }: { project: any, activePath: string, children: React.ReactNode | ((isOver: boolean) => React.ReactNode) }) {
    const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
        id: project.id,
        data: { project, type: 'Project' }
    })

    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: project.id,
        data: { project, type: 'Project' }
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none'
    }

    // Compose refs
    const setNodeRef = (node: HTMLElement | null) => {
        setDragRef(node)
        setDropRef(node)
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={clsx(
                "transition-all duration-200 border-l-4 border-transparent w-full",
                isOver ? "bg-blue-600 border-blue-400 shadow-lg scale-[1.02] z-20" : "hover:bg-gray-50/50"
            )}
        >
            {typeof children === 'function' ? children(isOver) : children}
        </div>
    )
}

function DroppableZone({ id, data, children, className }: { id: string, data?: any, children?: React.ReactNode, className?: string }) {
    const { setNodeRef, isOver } = useDroppable({ id, data })

    return (
        <div
            ref={setNodeRef}
            className={clsx(
                className,
                "transition-all duration-200",
                isOver && "bg-blue-600/10 ring-4 ring-blue-400/50 rounded-xl"
            )}
        >
            {children}
        </div>
    )
}

export function DroppableNavItem({ label, children, className }: { label: string, children: React.ReactNode | ((isOver: boolean) => React.ReactNode), className?: string }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `nav-${label.toLowerCase()}`,
        data: { type: 'Nav', label }
    })

    return (
        <div
            ref={setNodeRef}
            className={clsx(
                "transition-all duration-200",
                isOver ? "bg-blue-600 border-blue-400 shadow-lg scale-[1.02] z-20" : "",
                className
            )}
        >
            {typeof children === 'function' ? children(isOver) : children}
        </div>
    )
}

// --- Main Sidebar Component ---

export function Sidebar({ activePath, onItemClick }: SidebarProps) {
    const { data: allTasks } = useAllTasks()
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

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

    // Create Project State
    const [isCreatingProjectIn, setIsCreatingProjectIn] = useState<string | null>(null) // 'ungrouped' or groupId
    const [newProjectName, setNewProjectName] = useState("")
    const [isProjectsExpanded, setIsProjectsExpanded] = useState(false)
    const [isTagsExpanded, setIsTagsExpanded] = useState(false)
    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null)

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

    const renderProjectItem = (project: any) => {
        const isActive = activePath === `/projects/${project.id}`
        return (
            <DraggableProject key={project.id} project={project} activePath={activePath}>
                {(isOver) => (
                    <div className="relative group/project">
                        <Link
                            to={`/projects/${project.id}`}
                            onClick={onItemClick}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-1 transition-colors text-sm",
                                isOver ? "text-white" : (isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-600"),
                                "font-medium"
                            )}
                        >
                            <Folder size={16} />
                            <span className="whitespace-nowrap truncate flex-1 leading-none pb-0.5">
                                {project.name}
                            </span>

                            <ProjectActionsMenu
                                project={project}
                                onRename={handleRenameProject}
                                onDelete={handleDeleteProject}
                                isOver={isOver}
                            />
                        </Link>
                    </div>
                )}
            </DraggableProject>
        )
    }

    const navItems = [
        { label: "Dashboard", path: "/", icon: LayoutDashboard, droppable: false },
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
            count: allTasks?.filter(t => !t.is_completed && t.due_date && isToday(parseISO(t.due_date))).length,
            droppable: false
        },
        {
            label: "Tomorrow",
            path: "/tomorrow",
            icon: Sunrise, // Distinct icon for Tomorrow
            count: allTasks?.filter(t => !t.is_completed && t.due_date && isTomorrow(parseISO(t.due_date))).length,
            droppable: false
        },
        { label: "Calendar", path: "/calendar", icon: Calendar, droppable: false },
    ]

    return (
        <div className="space-y-1">


            {/* Main Navigation */}
            <div className="space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activePath === item.path

                    const renderLink = (isOver: boolean = false) => (
                        <Link
                            to={item.path}
                            onClick={onItemClick}
                            className={clsx(
                                "flex items-center gap-3 px-4 py-1 transition-colors",
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
                        <DroppableZone id="projects-root" data={{ type: 'Folder', root: true }} className="space-y-0.5 min-h-[50px]">
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
                )}

            </div>


        </div>
    )
}
