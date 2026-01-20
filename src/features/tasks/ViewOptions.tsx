import { Fragment } from 'react'
import {
    LayoutList,
    Flag,
    Calendar,
    Folder,
    Tag,
    Activity,
    Hash
} from 'lucide-react'
import clsx from 'clsx'
import { Menu, Transition } from '@headlessui/react'
import { CATEGORIES } from '@/features/tags/constants'

export type SortOption = 'manual' | 'date_created' | 'due_date' | 'alphabetical'
export type GroupOption = 'none' | 'date' | 'priority' | 'project' | 'tag' | 'complexity' | 'tag-place' | 'tag-energy' | 'tag-time' | 'tag-people' | 'tag-other'

type ViewOptionsProps = {
    groupBy: GroupOption
    setGroupBy: (group: GroupOption) => void
}

export function ViewOptions({
    groupBy, setGroupBy
}: ViewOptionsProps) {
    return (
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 p-1 shadow-sm h-10">
            {/* Grouping - Icon Only */}
            <div className="flex items-center gap-0.5">
                <GroupIconBtn
                    active={groupBy === 'none'}
                    onClick={() => setGroupBy('none')}
                    icon={<LayoutList size={18} />}
                    title="No Grouping"
                />
                <GroupIconBtn
                    active={groupBy === 'priority'}
                    onClick={() => setGroupBy('priority')}
                    icon={<Flag size={18} />}
                    title="Group by Priority"
                />
                <GroupIconBtn
                    active={groupBy === 'date'}
                    onClick={() => setGroupBy('date')}
                    icon={<Calendar size={18} />}
                    title="Group by Date"
                />
                <GroupIconBtn
                    active={groupBy === 'project'}
                    onClick={() => setGroupBy('project')}
                    icon={<Folder size={18} />}
                    title="Group by Project"
                />

                {/* Group by Tags (Dropdown) */}
                <Menu as="div" className="relative">
                    <Menu.Button as="div" role="button">
                        <GroupIconBtn
                            active={groupBy.startsWith('tag')}
                            onClick={() => { }}
                            icon={<Tag size={18} />}
                            title="Group by Tags"
                        />
                    </Menu.Button>
                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                    >
                        <Menu.Items className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-50 focus:outline-none origin-top-right">
                            <div className="p-1 space-y-0.5">
                                <div className="px-2 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">
                                    Sort by Category
                                </div>
                                {CATEGORIES.map(cat => (
                                    <Menu.Item key={cat.id}>
                                        {({ active }) => (
                                            <button
                                                onClick={() => setGroupBy(`tag-${cat.id}` as GroupOption)}
                                                className={clsx(
                                                    "w-full text-left px-2 py-2 text-xs rounded-lg flex items-center gap-2 transition-colors",
                                                    active ? "bg-gray-50/80 text-gray-900" : "text-gray-600",
                                                    groupBy === `tag-${cat.id}` && "bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-100"
                                                )}
                                            >
                                                <cat.icon size={14} className={cat.color} />
                                                {cat.label}
                                            </button>
                                        )}
                                    </Menu.Item>
                                ))}
                                <Menu.Item>
                                    {({ active }) => (
                                        <button
                                            onClick={() => setGroupBy('tag-other')}
                                            className={clsx(
                                                "w-full text-left px-2 py-2 text-xs rounded-lg flex items-center gap-2 transition-colors",
                                                active ? "bg-gray-50/80 text-gray-900" : "text-gray-600",
                                                groupBy === 'tag-other' && "bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-100"
                                            )}
                                        >
                                            <Hash size={14} className="text-gray-400" />
                                            Others
                                        </button>
                                    )}
                                </Menu.Item>
                                <div className="h-px bg-gray-100 my-1" />
                                <Menu.Item>
                                    {({ active }) => (
                                        <button
                                            onClick={() => setGroupBy('tag')}
                                            className={clsx(
                                                "w-full text-left px-2 py-2 text-xs rounded-lg flex items-center gap-2 transition-colors",
                                                active ? "bg-gray-50/80 text-gray-900" : "text-gray-600",
                                                groupBy === 'tag' && "bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-100"
                                            )}
                                        >
                                            <Tag size={14} className="text-gray-400" />
                                            All Tags
                                        </button>
                                    )}
                                </Menu.Item>
                            </div>
                        </Menu.Items>
                    </Transition>
                </Menu>

                <GroupIconBtn
                    active={groupBy === 'complexity'}
                    onClick={() => setGroupBy('complexity')}
                    icon={<Activity size={18} />}
                    title="Group by Complexity"
                />
            </div>
        </div>
    )
}

function GroupIconBtn({ active, onClick, icon, title }: { active: boolean, onClick: () => void, icon: React.ReactNode, title: string }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={clsx(
                "p-2 rounded-lg transition-all active:scale-95",
                active ? "bg-gray-100 text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            )}
        >
            {icon}
        </button>
    )
}
