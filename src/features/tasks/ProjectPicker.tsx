import { useState, useRef, useEffect } from 'react'
import { Folder, ChevronRight, Check, Inbox, Columns } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { useProjectGroups } from '@/hooks/useProjectGroups'
import { useAllSections } from '@/hooks/useAllSections'
import clsx from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'

type ProjectPickerProps = {
    projectId: string | null
    sectionId: string | null
    onSelect: (projectId: string | null, sectionId: string | null) => void
}

export function ProjectPicker({ projectId, sectionId, onSelect }: ProjectPickerProps) {
    const { data: projects } = useProjects()
    const { data: groups } = useProjectGroups()
    const { data: sections } = useAllSections()

    const [isOpen, setIsOpen] = useState(false)
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const containerRef = useRef<HTMLDivElement>(null)

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // Auto-expand current selection
    useEffect(() => {
        if (projectId && isOpen) {
            setExpandedIds(prev => {
                const next = new Set(prev)
                next.add(projectId)
                const project = projects?.find(p => p.id === projectId)
                if (project && project.group_id) {
                    next.add(project.group_id)
                }
                return next
            })
        }
    }, [projectId, projects, isOpen])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const currentProject = projects?.find(p => p.id === projectId)
    const currentSection = sections?.find(s => s.id === sectionId)

    const ungroupedProjects = projects?.filter(p => !p.group_id) || []

    const renderSectionItem = (projId: string, section: any) => {
        const isSelected = projectId === projId && sectionId === section.id
        return (
            <div
                key={section.id}
                onClick={() => { onSelect(projId, section.id); setIsOpen(false) }}
                className={clsx(
                    "flex items-center gap-2 px-2 py-1.5 text-xs rounded-md cursor-pointer ml-6 relative",
                    isSelected ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                )}
            >
                <div className="absolute left-[-16px] top-1/2 w-3 h-px bg-gray-200" /> {/* Connector line */}
                <Columns size={12} className="opacity-70" />
                <span className="truncate">{section.name}</span>
                {isSelected && <Check size={12} className="ml-auto" />}
            </div>
        )
    }

    const renderProjectItem = (project: any, depth = 0) => {
        const projectSections = sections?.filter(s => s.project_id === project.id) || []
        const isExpanded = expandedIds.has(project.id)
        const isProjectSelected = projectId === project.id && !sectionId

        return (
            <div key={project.id} className="relative">
                <div
                    className={clsx(
                        "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer select-none group transition-colors",
                        isProjectSelected ? "bg-blue-50 text-blue-600" : "hover:bg-gray-100 text-gray-700"
                    )}
                    onClick={() => { onSelect(project.id, null); setIsOpen(false) }}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                >
                    {projectSections.length > 0 ? (
                        <div
                            onClick={(e) => toggleExpand(project.id, e)}
                            className="p-0.5 hover:bg-gray-200 rounded text-gray-400 transition-colors cursor-pointer"
                        >
                            <ChevronRight size={14} className={clsx("transition-transform duration-200", isExpanded && "rotate-90")} />
                        </div>
                    ) : (
                        <div className="w-[18px]" />
                    )}

                    <Folder size={15} className={clsx("shrink-0", isProjectSelected ? "text-blue-500 fill-current opacity-20" : "text-gray-400")} />
                    <span className="truncate text-sm font-medium flex-1">{project.name}</span>
                    {isProjectSelected && <Check size={14} className="ml-auto text-blue-500" />}
                </div>

                {/* Sections List */}
                <AnimatePresence>
                    {isExpanded && projectSections.length > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="border-l border-gray-100 ml-[calc(8px+9px)] my-1 space-y-0.5">
                                {projectSections.map(s => renderSectionItem(project.id, s))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        )
    }

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-100 hover:border-gray-300 transition-colors max-w-[240px]"
                title={currentProject ? `${currentProject.name}${currentSection ? ` / ${currentSection.name}` : ''}` : 'Inbox'}
            >
                <Folder size={16} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700 truncate">
                    {currentProject ? (
                        <>
                            <span className="font-semibold text-gray-800">{currentProject.name}</span>
                            {currentSection && <span className="text-gray-500 font-medium"> / {currentSection.name}</span>}
                        </>
                    ) : (
                        <span className="text-gray-600">Inbox</span>
                    )}
                </span>
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-72 max-h-[400px] overflow-y-auto bg-white border border-gray-200 shadow-xl rounded-lg z-50 py-2 animate-in fade-in zoom-in-95 duration-100 flex flex-col custom-scrollbar">

                    {/* Inbox */}
                    <div
                        onClick={() => { onSelect(null, null); setIsOpen(false) }}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-2 mx-2 rounded-md hover:bg-gray-100 cursor-pointer text-sm mb-2 transition-colors",
                            !projectId ? "bg-blue-50 text-blue-600" : "text-gray-700"
                        )}
                    >
                        <Inbox size={16} />
                        <span className="font-medium">Inbox</span>
                        {!projectId && <Check size={14} className="ml-auto" />}
                    </div>

                    <div className="h-px bg-gray-100 mx-2 mb-2" />

                    <div className="flex-1 overflow-y-auto px-2 space-y-1">
                        {/* Ungrouped Projects */}
                        {ungroupedProjects.map(p => renderProjectItem(p))}

                        {/* Groups */}
                        {groups?.map(group => {
                            const groupProjects = projects?.filter(p => p.group_id === group.id)
                            if (!groupProjects?.length) return null

                            const isExpanded = expandedIds.has(group.id)

                            return (
                                <div key={group.id} className="mt-3 first:mt-1">
                                    <div
                                        className="px-2 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:text-gray-600 select-none"
                                        onClick={(e) => toggleExpand(group.id, e)}
                                    >
                                        <ChevronRight size={12} className={clsx("transition-transform duration-200", isExpanded && "rotate-90")} />
                                        {group.name}
                                    </div>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="ml-1 space-y-0.5">
                                                    {groupProjects.map(p => renderProjectItem(p, 1))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
