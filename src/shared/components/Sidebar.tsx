import { useNavigate } from "react-router-dom"
import { Folder, Plus, ChevronRight, Edit2, MoreVertical } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import clsx from "clsx"
import { useProjects } from "@/hooks/useProjects"
import { useProjectGroups, useCreateProjectGroup, useDeleteProjectGroup, useUpdateProjectGroup } from "@/hooks/useProjectGroups"
import { useCreateProject } from "@/hooks/useCreateProject"
import { useUpdateProject } from "@/hooks/useUpdateProject"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"

type SidebarProps = {
    activePath: string
}

export function Sidebar({ activePath }: SidebarProps) {
    const { data: projects } = useProjects()
    const { data: groups, isLoading: isGroupsLoading } = useProjectGroups()
    const { mutate: createGroup } = useCreateProjectGroup()
    const { mutate: createProject, isPending: isCreatingProject } = useCreateProject()
    const { mutate: updateGroup } = useUpdateProjectGroup()
    const { mutate: updateProject } = useUpdateProject() // For moving projects

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
    const [creatingProjectInGroup, setCreatingProjectInGroup] = useState<string | null>(null)
    const [newProjectName, setNewProjectName] = useState("")
    const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null) // Project ID

    const navigate = useNavigate()
    const projectMenuRef = useRef<HTMLDivElement>(null)

    // Bootstrap groups if needed (Only logic, can be extracted)
    useEffect(() => {
        const bootstrapGroups = async () => {
            if (isGroupsLoading) return
            if (groups && groups.length === 0) {
                // Check if user has executed the boostrap before doing it? 
                // We'll simplisticly try to create default groups if fetch returns 0 array
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    await Promise.all([
                        createGroup({ name: 'Current Projects', userId: user.id }),
                        createGroup({ name: 'Future Projects', userId: user.id }),
                        createGroup({ name: 'Ideas', userId: user.id })
                    ])
                }
            }
        }
        bootstrapGroups()
    }, [groups, isGroupsLoading, createGroup])

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
                setProjectMenuOpen(null)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const toggleGroup = (groupId: string) => {
        setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
    }

    const handleCreateProject = async (e: React.FormEvent, groupId: string | undefined) => {
        e.preventDefault()
        if (!newProjectName.trim()) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        createProject({ name: newProjectName, userId: user.id, groupId }, {
            onSuccess: (project) => {
                setCreatingProjectInGroup(null)
                setNewProjectName("")
                navigate(`/projects/${project.id}`)
            }
        })
    }

    const handleMoveToGroup = (projectId: string, groupId: string | null) => {
        updateProject({ projectId, updates: { group_id: groupId } })
        setProjectMenuOpen(null)
    }

    const renderProjectItem = (project: any) => (
        <div key={project.id} className="relative group/project">
            <Link
                to={`/projects/${project.id}`}
                className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm text-gray-600 hover:bg-gray-100",
                    activePath === `/projects/${project.id}` && "bg-blue-50 text-blue-600"
                )}
            >
                <Folder size={16} />
                <span className="whitespace-nowrap truncate flex-1">
                    {project.name}
                </span>
            </Link>
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setProjectMenuOpen(projectMenuOpen === project.id ? null : project.id)
                }}
                className={clsx(
                    "absolute right-2 top-1.5 p-0.5 rounded text-gray-400 hover:text-gray-600 opacity-0 group-hover/project:opacity-100 transition-opacity",
                    projectMenuOpen === project.id && "opacity-100 bg-gray-200"
                )}
            >
                <MoreVertical size={14} />
            </button>

            {/* Project Context Menu */}
            {projectMenuOpen === project.id && (
                <div ref={projectMenuRef} className="absolute left-full top-0 ml-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-xs text-gray-400 font-semibold uppercase tracking-wider">
                        Move to...
                    </div>
                    <button
                        onClick={() => handleMoveToGroup(project.id, null)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                        <span>Inbox (No Group)</span>
                    </button>
                    {groups?.map(g => (
                        <button
                            key={g.id}
                            onClick={() => handleMoveToGroup(project.id, g.id)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 truncate"
                        >
                            <span>{g.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )

    return (
        <div className="mt-8 space-y-6">
            {/* 1. Groups */}
            {groups?.map(group => {
                const groupProjects = projects?.filter(p => p.group_id === group.id)
                const isCollapsed = collapsedGroups[group.id]

                return (
                    <div key={group.id}>
                        <div className="px-3 mb-1 flex items-center justify-between group/header">
                            <button
                                onClick={() => toggleGroup(group.id)}
                                className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 outline-none"
                            >
                                <ChevronRight
                                    size={14}
                                    className={clsx("transition-transform duration-200", !isCollapsed && "rotate-90")}
                                />
                                {group.name}
                            </button>

                            <button
                                onClick={() => {
                                    setCreatingProjectInGroup(group.id)
                                    // if collapsed, expand
                                    if (isCollapsed) toggleGroup(group.id)
                                }}
                                className="text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover/header:opacity-100 p-0.5"
                                title="Add Project"
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {!isCollapsed && (
                            <div className="space-y-0.5 pl-2">
                                {/* Create Input for this group */}
                                {creatingProjectInGroup === group.id && (
                                    <form onSubmit={(e) => handleCreateProject(e, group.id)} className="px-3 py-1">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newProjectName}
                                            onChange={(e) => setNewProjectName(e.target.value)}
                                            onBlur={() => !newProjectName && setCreatingProjectInGroup(null)}
                                            placeholder="New Project..."
                                            disabled={isCreatingProject}
                                            className="w-full py-1 px-2 text-sm bg-gray-50 border border-blue-200 rounded focus:border-blue-500 focus:outline-none"
                                        />
                                    </form>
                                )}

                                {groupProjects?.map(renderProjectItem)}

                                {groupProjects?.length === 0 && !creatingProjectInGroup && (
                                    <div className="px-3 py-1 text-xs text-gray-300 italic">No projects</div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* 2. Ungrouped Projects (Inbox) */}
            <div>
                <div className="px-3 mb-1 flex items-center justify-between group/header">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-4">
                        Ungrouped
                    </span>
                    <button
                        onClick={() => setCreatingProjectInGroup('ungrouped')}
                        className="text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover/header:opacity-100 p-0.5"
                        title="Add Project"
                    >
                        <Plus size={14} />
                    </button>
                </div>
                <div className="space-y-0.5 pl-2">
                    {creatingProjectInGroup === 'ungrouped' && (
                        <form onSubmit={(e) => handleCreateProject(e, undefined)} className="px-3 py-1">
                            <input
                                autoFocus
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                onBlur={() => !newProjectName && setCreatingProjectInGroup(null)}
                                placeholder="New Project..."
                                disabled={isCreatingProject}
                                className="w-full py-1 px-2 text-sm bg-gray-50 border border-blue-200 rounded focus:border-blue-500 focus:outline-none"
                            />
                        </form>
                    )}
                    {projects?.filter(p => !p.group_id).map(renderProjectItem)}
                </div>
            </div>

        </div>
    )
}
