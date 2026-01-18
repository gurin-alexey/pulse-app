import {
    LayoutList,
    Flag,
    Calendar,
    Folder,
    Tag,
    Activity
} from 'lucide-react'
import clsx from 'clsx'

export type SortOption = 'manual' | 'date_created' | 'due_date' | 'alphabetical'
export type GroupOption = 'none' | 'date' | 'priority' | 'project' | 'tag' | 'complexity'

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
                <GroupIconBtn
                    active={groupBy === 'tag'}
                    onClick={() => setGroupBy('tag')}
                    icon={<Tag size={18} />}
                    title="Group by Tags"
                />
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
