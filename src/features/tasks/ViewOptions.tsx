import { useState, useRef, useEffect } from 'react'
import { Settings2, CheckCircle2, Circle, Calendar, SortAsc, LayoutList } from 'lucide-react'
import clsx from 'clsx'

export type SortOption = 'date_created' | 'due_date' | 'alphabetical'
export type GroupOption = 'none' | 'date' | 'status'

type ViewOptionsProps = {
    sortBy: SortOption
    setSortBy: (sort: SortOption) => void
    groupBy: GroupOption
    setGroupBy: (group: GroupOption) => void
    showCompleted: boolean
    setShowCompleted: (show: boolean) => void
}

export function ViewOptions({
    sortBy, setSortBy,
    groupBy, setGroupBy,
    showCompleted, setShowCompleted
}: ViewOptionsProps) {
    const [isOpen, setIsOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
                title="View Options"
            >
                <Settings2 size={20} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-100">

                    {/* Filter Section */}
                    <div className="px-3 py-2 border-b border-gray-100">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-sm font-medium text-gray-700">Show Completed</span>
                            <div
                                onClick={() => setShowCompleted(!showCompleted)}
                                className={clsx(
                                    "w-9 h-5 rounded-full relative transition-colors",
                                    showCompleted ? "bg-blue-600" : "bg-gray-200"
                                )}
                            >
                                <div className={clsx(
                                    "w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform",
                                    showCompleted ? "left-[calc(100%-4px)] -translate-x-full" : "left-1"
                                )} />
                            </div>
                        </label>
                    </div>

                    {/* Grouping Section */}
                    <div className="px-3 py-2 border-b border-gray-100">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Group By</div>
                        <div className="space-y-1">
                            <button
                                onClick={() => setGroupBy('none')}
                                className={clsx("w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2", groupBy === 'none' ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50 text-gray-700")}
                            >
                                <LayoutList size={16} /> None
                            </button>
                            <button
                                onClick={() => setGroupBy('date')}
                                className={clsx("w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2", groupBy === 'date' ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50 text-gray-700")}
                            >
                                <Calendar size={16} /> Due Date
                            </button>
                            <button
                                onClick={() => setGroupBy('status')}
                                className={clsx("w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2", groupBy === 'status' ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50 text-gray-700")}
                            >
                                <CheckCircle2 size={16} /> Status
                            </button>
                        </div>
                    </div>

                    {/* Sorting Section */}
                    <div className="px-3 py-2">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sort By</div>
                        <div className="space-y-1">
                            <button
                                onClick={() => setSortBy('date_created')}
                                className={clsx("w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2", sortBy === 'date_created' ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50 text-gray-700")}
                            >
                                <SortAsc size={16} /> Date Created
                            </button>
                            <button
                                onClick={() => setSortBy('due_date')}
                                className={clsx("w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2", sortBy === 'due_date' ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50 text-gray-700")}
                            >
                                <Calendar size={16} /> Due Date
                            </button>
                            <button
                                onClick={() => setSortBy('alphabetical')}
                                className={clsx("w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2", sortBy === 'alphabetical' ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50 text-gray-700")}
                            >
                                <SortAsc size={16} className="rotate-90" /> Alphabetical
                            </button>
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
