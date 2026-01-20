import { useRef, useEffect, Fragment } from "react"
import clsx from "clsx"
import { Check, Info, X, EyeOff, MapPin, ChevronDown, ChevronRight, Hash, Folder, Filter, RefreshCw, Users } from "lucide-react"
import { useTags } from "@/features/tags"
import { useTodayFilter } from "@/hooks/useTodayFilter"
import { useProjects } from "@/hooks/useProjects"
import { Popover, Transition } from '@headlessui/react'

export function TodayFilterBar() {
    const { data: tags } = useTags()
    const { filter, toggleExcludedTag, toggleExcludedProject, setExcludedTags, setExcludedProjects, resetFilters } = useTodayFilter()
    const { data: projects } = useProjects()

    // Filter tags by category 'place'
    // Filter tags by category 'place'
    const placeTags = tags?.filter(t => t.category === 'place') || []
    const peopleTags = tags?.filter(t => t.category === 'people') || []

    const toggleAllTags = (tagsToToggle: typeof placeTags) => {
        const allIds = tagsToToggle.map(t => t.id)
        const currentExcluded = new Set(filter.excludedTagIds)
        const relevantExcluded = allIds.filter(id => currentExcluded.has(id))

        if (relevantExcluded.length === allIds.length) {
            // All excluded -> Show all (remove from excluded)
            const newExcluded = filter.excludedTagIds.filter(id => !allIds.includes(id))
            setExcludedTags(newExcluded)
        } else {
            // Some or None excluded -> Hide all (add missing to excluded)
            const newExcluded = Array.from(new Set([...filter.excludedTagIds, ...allIds]))
            setExcludedTags(newExcluded)
        }
    }

    const toggleAllProjects = () => {
        if (!projects) return
        const allIds = projects.map(p => p.id)
        const currentExcluded = new Set(filter.excludedProjectIds || [])
        const relevantExcluded = allIds.filter(id => currentExcluded.has(id))

        if (relevantExcluded.length === allIds.length) {
            // All excluded -> Show all
            const newExcluded = (filter.excludedProjectIds || []).filter(id => !allIds.includes(id))
            setExcludedProjects(newExcluded)
        } else {
            // Hide all
            const newExcluded = Array.from(new Set([...(filter.excludedProjectIds || []), ...allIds]))
            setExcludedProjects(newExcluded)
        }
    }

    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/50 border-b border-gray-100 animate-in slide-in-from-top-2 duration-200">
            <div className="text-xs font-semibold text-gray-500 mr-2 flex items-center gap-1">
                <Filter size={12} />
                Filters:
            </div>

            {/* Place Filter Dropdown */}
            <Popover className="relative">
                <Popover.Button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100">
                    <MapPin size={14} className="text-red-500" />
                    <span>Place</span>
                    <ChevronDown size={14} className="text-gray-400" />
                </Popover.Button>

                <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                >
                    <Popover.Panel className="absolute z-50 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-100 focus:outline-none p-1">
                        <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-50 mb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exclude Places</span>
                            <button onClick={() => toggleAllTags(placeTags)} className="text-[10px] text-blue-600 hover:underline">
                                Select All
                            </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-0.5">
                            {placeTags.length === 0 && <div className="px-3 py-2 text-xs text-gray-400 italic">No places found</div>}
                            {placeTags.map(tag => {
                                const isExcluded = filter.excludedTagIds.includes(tag.id)
                                return (
                                    <button
                                        key={tag.id}
                                        onClick={() => toggleExcludedTag(tag.id)}
                                        className={clsx(
                                            "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all",
                                            isExcluded ? "bg-red-50 text-gray-500" : "hover:bg-gray-50 text-gray-700"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={clsx("w-2 h-2 rounded-full", isExcluded ? "bg-gray-300" : "bg-red-400")} />
                                            <span className={clsx(isExcluded && "line-through decoration-gray-300")}>{tag.name}</span>
                                        </div>
                                        {isExcluded && <EyeOff size={12} className="text-gray-400" />}
                                    </button>
                                )
                            })}
                        </div>
                    </Popover.Panel>
                </Transition>
            </Popover>

            {/* People Filter Dropdown */}
            <Popover className="relative">
                <Popover.Button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100">
                    <Users size={14} className="text-purple-500" />
                    <span>People</span>
                    <ChevronDown size={14} className="text-gray-400" />
                </Popover.Button>

                <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                >
                    <Popover.Panel className="absolute z-50 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-100 focus:outline-none p-1">
                        <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-50 mb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exclude People</span>
                            <button onClick={() => toggleAllTags(peopleTags)} className="text-[10px] text-blue-600 hover:underline">
                                Select All
                            </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-0.5">
                            {peopleTags.length === 0 && <div className="px-3 py-2 text-xs text-gray-400 italic">No people found</div>}
                            {peopleTags.map(tag => {
                                const isExcluded = filter.excludedTagIds.includes(tag.id)
                                return (
                                    <button
                                        key={tag.id}
                                        onClick={() => toggleExcludedTag(tag.id)}
                                        className={clsx(
                                            "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all",
                                            isExcluded ? "bg-red-50 text-gray-500" : "hover:bg-gray-50 text-gray-700"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={clsx("w-2 h-2 rounded-full", isExcluded ? "bg-gray-300" : "bg-purple-400")} />
                                            <span className={clsx(isExcluded && "line-through decoration-gray-300")}>{tag.name}</span>
                                        </div>
                                        {isExcluded && <EyeOff size={12} className="text-gray-400" />}
                                    </button>
                                )
                            })}
                        </div>
                    </Popover.Panel>
                </Transition>
            </Popover>

            {/* List (Project) Filter Dropdown */}
            <Popover className="relative">
                <Popover.Button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100">
                    <Folder size={14} className="text-blue-500" />
                    <span>List</span>
                    <ChevronDown size={14} className="text-gray-400" />
                </Popover.Button>

                <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                >
                    <Popover.Panel className="absolute z-50 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-100 focus:outline-none p-1">
                        <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-50 mb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exclude Lists</span>
                            <div className="flex items-center gap-2">
                                <button onClick={toggleAllProjects} className="text-[10px] text-blue-600 hover:underline">
                                    Select All
                                </button>
                                <div className="w-px h-3 bg-gray-200" />
                                <button onClick={resetFilters} className="text-[10px] text-red-500 hover:underline flex items-center gap-1" title="Reset All Filters">
                                    Reset
                                </button>
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-0.5">
                            {(!projects || projects.length === 0) && <div className="px-3 py-2 text-xs text-gray-400 italic">No lists found</div>}
                            {projects?.map(project => {
                                const isExcluded = filter.excludedProjectIds?.includes(project.id)
                                return (
                                    <button
                                        key={project.id}
                                        onClick={() => toggleExcludedProject(project.id)}
                                        className={clsx(
                                            "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all",
                                            isExcluded ? "bg-red-50 text-gray-500" : "hover:bg-gray-50 text-gray-700"
                                        )}
                                    >
                                        <span className={clsx("truncate pr-2", isExcluded && "line-through decoration-gray-300")}>{project.name}</span>
                                        {isExcluded && <EyeOff size={12} className="text-gray-400" />}
                                    </button>
                                )
                            })}
                        </div>
                    </Popover.Panel>
                </Transition>
            </Popover>

            {/* Reset / Info */}
            {(filter.excludedTagIds.length > 0 || (filter.excludedProjectIds?.length || 0) > 0) && (
                <button onClick={resetFilters} className="ml-auto flex items-center gap-2 text-[10px] text-gray-500 hover:bg-gray-100 px-2 py-1 rounded-full transition-colors">
                    <RefreshCw size={10} />
                    <span>Reset All ({filter.excludedTagIds.length + (filter.excludedProjectIds?.length || 0)})</span>
                </button>
            )}
        </div>
    )
}
