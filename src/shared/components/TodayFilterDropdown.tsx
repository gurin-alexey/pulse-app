import { useRef, useEffect } from "react"
import clsx from "clsx"
import { Check, Filter, X, EyeOff, MapPin, ChevronDown, ChevronRight, Hash, Folder } from "lucide-react"
import { useTags } from "@/features/tags"
import { useTodayFilter } from "@/hooks/useTodayFilter"
import { useProjects } from "@/hooks/useProjects"
import { CATEGORIES } from "@/features/tags/constants"
import { motion, AnimatePresence } from "framer-motion"
import { Disclosure } from '@headlessui/react'

type TodayFilterDropdownProps = {
    isOpen: boolean
    onClose: () => void
    position: { top: number, left: number }
}

export function TodayFilterDropdown({ isOpen, onClose, position }: TodayFilterDropdownProps) {
    const dropdownRef = useRef<HTMLDivElement>(null)
    const { data: tags } = useTags()
    const { filter, toggleExcludedTag, toggleExcludedProject } = useTodayFilter()
    const { data: projects } = useProjects()

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    // Filter tags by category 'place'
    const placeTags = tags?.filter(t => t.category === 'place') || []

    // Group remaining tags? But user asked specifically for "Place" and "List"
    // We can add "Other Tags" if needed, but let's prioritize requested features.

    const hasActiveFilters = filter.excludedTagIds.length > 0 || (filter.excludedProjectIds && filter.excludedProjectIds.length > 0)

    return (
        <div
            ref={dropdownRef}
            className="fixed z-[100] w-72 bg-white rounded-xl shadow-2xl border border-gray-100 flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{
                top: position.top,
                left: position.left,
            }}
        >
            <div className="p-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                    <Filter size={14} />
                    <span>Display Settings</span>
                </div>
                {hasActiveFilters && (
                    <button
                        onClick={() => {
                            // Reset logic implies iterating or setting empty. 
                            // Current hook doesn't have clearAll. 
                            // We can just iterate active and toggle them off, or add clearAll later.
                            // For now simple UI.
                        }}
                        className="text-[10px] text-blue-600 font-medium hover:underline"
                    >
                        {filter.excludedTagIds.length + (filter.excludedProjectIds?.length || 0)} hidden
                    </button>
                )}
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-1">

                {/* Section: By Place */}
                <Disclosure defaultOpen>
                    {({ open }) => (
                        <div className="rounded-lg overflow-hidden border border-gray-100 bg-white">
                            <Disclosure.Button className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-red-500" />
                                    <span>Filter by Place</span>
                                </div>
                                <ChevronRight size={14} className={clsx("text-gray-400 transition-transform", open && "rotate-90")} />
                            </Disclosure.Button>

                            <Disclosure.Panel className="px-1 pb-1 pt-0">
                                <div className="space-y-0.5 mt-1">
                                    {placeTags.length === 0 && (
                                        <div className="px-2 py-2 text-xs text-gray-400 italic text-center">No place tags found</div>
                                    )}
                                    {placeTags.map(tag => {
                                        const isExcluded = filter.excludedTagIds.includes(tag.id)
                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => toggleExcludedTag(tag.id)}
                                                className={clsx(
                                                    "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all",
                                                    isExcluded
                                                        ? "bg-red-50 text-gray-400 hover:bg-red-100"
                                                        : "hover:bg-gray-50 text-gray-700"
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={clsx(
                                                        "w-2 h-2 rounded-full",
                                                        isExcluded ? "bg-gray-300" : "bg-red-400"
                                                    )} />
                                                    <span className={clsx(isExcluded && "line-through decoration-gray-400")}>
                                                        {tag.name}
                                                    </span>
                                                </div>
                                                {isExcluded ? (
                                                    <EyeOff size={12} className="text-gray-400" />
                                                ) : (
                                                    <Check size={12} className="text-transparent" />
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </Disclosure.Panel>
                        </div>
                    )}
                </Disclosure>

                {/* Section: By List (Project) */}
                <Disclosure defaultOpen>
                    {({ open }) => (
                        <div className="rounded-lg overflow-hidden border border-gray-100 bg-white">
                            <Disclosure.Button className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Folder size={14} className="text-blue-500" />
                                    <span>Filter by List</span>
                                </div>
                                <ChevronRight size={14} className={clsx("text-gray-400 transition-transform", open && "rotate-90")} />
                            </Disclosure.Button>

                            <Disclosure.Panel className="px-1 pb-1 pt-0">
                                <div className="space-y-0.5 mt-1">
                                    {!projects || projects.length === 0 && (
                                        <div className="px-2 py-2 text-xs text-gray-400 italic text-center">No projects found</div>
                                    )}
                                    {projects?.map(project => {
                                        const isExcluded = filter.excludedProjectIds?.includes(project.id)
                                        return (
                                            <button
                                                key={project.id}
                                                onClick={() => toggleExcludedProject(project.id)}
                                                className={clsx(
                                                    "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all",
                                                    isExcluded
                                                        ? "bg-red-50 text-gray-400 hover:bg-red-100"
                                                        : "hover:bg-gray-50 text-gray-700"
                                                )}
                                            >
                                                <span className={clsx("truncate pr-2", isExcluded && "line-through decoration-gray-400")}>
                                                    {project.name}
                                                </span>
                                                {isExcluded ? (
                                                    <EyeOff size={12} className="text-gray-400" />
                                                ) : (
                                                    <span />
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </Disclosure.Panel>
                        </div>
                    )}
                </Disclosure>

                {/* Section: Other Tags */}
                <Disclosure>
                    {({ open }) => (
                        <div className="rounded-lg overflow-hidden border border-gray-100 bg-white">
                            <Disclosure.Button className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Hash size={14} className="text-gray-400" />
                                    <span>Other Tags</span>
                                </div>
                                <ChevronRight size={14} className={clsx("text-gray-400 transition-transform", open && "rotate-90")} />
                            </Disclosure.Button>

                            <Disclosure.Panel className="px-1 pb-1 pt-0">
                                <div className="space-y-0.5 mt-1">
                                    {tags?.filter(t => t.category !== 'place').map(tag => {
                                        const isExcluded = filter.excludedTagIds.includes(tag.id)
                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => toggleExcludedTag(tag.id)}
                                                className={clsx(
                                                    "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all",
                                                    isExcluded
                                                        ? "bg-red-50 text-gray-400 hover:bg-red-100"
                                                        : "hover:bg-gray-50 text-gray-700"
                                                )}
                                            >
                                                <span className={clsx("truncate", isExcluded && "line-through decoration-gray-400")}>
                                                    {tag.name}
                                                </span>
                                                {isExcluded && <EyeOff size={12} className="text-gray-400" />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </Disclosure.Panel>
                        </div>
                    )}
                </Disclosure>
            </div>

            <div className="p-2 border-t border-gray-50 bg-gray-50/30 text-[10px] text-gray-400 text-center">
                Hidden items will stay in inbox/projects
            </div>
        </div>
    )
}
