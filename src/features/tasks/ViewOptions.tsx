import { useState, useRef, useEffect } from 'react'
import { Settings2, CheckCircle2, Circle, Calendar, SortAsc, LayoutList, Flag, Folder, Tag as TagIcon, Layers, ArrowUpDown, ListTree } from 'lucide-react'
import clsx from 'clsx'

export type SortOption = 'manual' | 'date_created' | 'due_date' | 'alphabetical'
export type GroupOption = 'none' | 'date' | 'priority' | 'project' | 'tag' | 'complexity'

type ViewOptionsProps = {
    sortBy: SortOption
    setSortBy: (sort: SortOption) => void
    groupBy: GroupOption
    setGroupBy: (group: GroupOption) => void
    onToggleSubtasks?: () => void
}

export function ViewOptions({
    sortBy, setSortBy,
    groupBy, setGroupBy,
    onToggleSubtasks
}: ViewOptionsProps) {
    return (
        <div className="flex items-center gap-2">
            <GroupDropdown groupBy={groupBy} setGroupBy={setGroupBy} />
            <div className="h-4 w-px bg-gray-200" />
            <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />
            {onToggleSubtasks && (
                <>
                    <div className="h-4 w-px bg-gray-200" />
                    <button
                        onClick={onToggleSubtasks}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                        title="Toggle Subtasks"
                    >
                        <ListTree size={16} />
                        <span className="hidden sm:inline">Subtasks</span>
                    </button>
                </>
            )}
        </div>
    )
}

function GroupDropdown({ groupBy, setGroupBy }: { groupBy: GroupOption, setGroupBy: (g: GroupOption) => void }) {
    const [isOpen, setIsOpen] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setIsOpen(true)
    }

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false)
        }, 150) // Small delay to prevent flickering when moving to the menu
    }

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                className={clsx(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    isOpen ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    groupBy !== 'none' && "text-blue-600 bg-blue-50 hover:bg-blue-100"
                )}
            >
                <Layers size={16} />
                <span className="hidden sm:inline">Group</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                        Group By
                    </div>
                    <GroupItem
                        active={groupBy === 'none'}
                        onClick={() => setGroupBy('none')}
                        icon={<LayoutList size={16} />}
                        label="None"
                    />
                    <GroupItem
                        active={groupBy === 'date'}
                        onClick={() => setGroupBy('date')}
                        icon={<Calendar size={16} />}
                        label="Due Date"
                    />
                    <GroupItem
                        active={groupBy === 'priority'}
                        onClick={() => setGroupBy('priority')}
                        icon={<Flag size={16} />}
                        label="Priority"
                    />
                    <GroupItem
                        active={groupBy === 'project'}
                        onClick={() => setGroupBy('project')}
                        icon={<Folder size={16} />}
                        label="Project"
                    />
                    <GroupItem
                        active={groupBy === 'tag'}
                        onClick={() => setGroupBy('tag')}
                        icon={<TagIcon size={16} />}
                        label="Tags"
                    />
                    <GroupItem
                        active={groupBy === 'complexity'}
                        onClick={() => setGroupBy('complexity')}
                        icon={<ListTree size={16} />}
                        label="Complexity"
                    />
                </div>
            )}
        </div>
    )
}

function SortDropdown({ sortBy, setSortBy }: { sortBy: SortOption, setSortBy: (s: SortOption) => void }) {
    const [isOpen, setIsOpen] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setIsOpen(true)
    }

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false)
        }, 150)
    }

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                className={clsx(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    isOpen ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    sortBy !== 'manual' && "text-blue-600 bg-blue-50 hover:bg-blue-100"
                )}
            >
                <ArrowUpDown size={16} />
                <span className="hidden sm:inline">Sort</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                        Sort By
                    </div>
                    <GroupItem
                        active={sortBy === 'manual'}
                        onClick={() => setSortBy('manual')}
                        icon={<SortAsc size={16} />}
                        label="Manual"
                    />
                    <GroupItem
                        active={sortBy === 'date_created'}
                        onClick={() => setSortBy('date_created')}
                        icon={<SortAsc size={16} />}
                        label="Date Created"
                    />
                    <GroupItem
                        active={sortBy === 'due_date'}
                        onClick={() => setSortBy('due_date')}
                        icon={<Calendar size={16} />}
                        label="Due Date"
                    />
                    <GroupItem
                        active={sortBy === 'alphabetical'}
                        onClick={() => setSortBy('alphabetical')}
                        icon={<SortAsc size={16} className="rotate-90" />}
                        label="Alphabetical"
                    />
                </div>
            )}
        </div>
    )
}

function GroupItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors mx-1 rounded-md",
                active ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"
            )}
            style={{ width: 'calc(100% - 8px)' }}
        >
            <span className={clsx("shrink-0", active ? "text-blue-600" : "text-gray-400")}>{icon}</span>
            <span>{label}</span>
            {active && <CheckCircle2 size={14} className="ml-auto" />}
        </button>
    )
}
