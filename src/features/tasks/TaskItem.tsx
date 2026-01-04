import { useNavigate, useSearchParams } from "react-router-dom"
import { useDeleteTask } from "@/hooks/useDeleteTask"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { CheckCircle2, Circle, Trash2, GripVertical } from "lucide-react"
import {
    SwipeableList,
    SwipeableListItem,
    SwipeAction,
    TrailingActions,
    LeadingActions,
    Type as SwipeType
} from 'react-swipeable-list'
import 'react-swipeable-list/dist/styles.css'
import { useTags, useToggleTaskTag, useTaskTags } from '@/hooks/useTags'
import { Sun, Calendar, Tag, ArrowRight, Clock, Plus, MoreHorizontal } from "lucide-react"
import clsx from "clsx"
import { useRef } from "react"

interface TaskItemProps {
    task: any
    isActive: boolean
    listeners?: any
    attributes?: any
}

export function TaskItem({ task, isActive, listeners, attributes }: TaskItemProps) {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { mutate: deleteTask } = useDeleteTask()
    const { mutate: updateTask } = useUpdateTask()
    const { data: allTags } = useTags()
    const { data: taskTags } = useTaskTags(task.id)
    const { mutate: toggleTag } = useToggleTaskTag()

    const dateInputRef = useRef<HTMLInputElement>(null)
    const timeInputRef = useRef<HTMLInputElement>(null)

    const handleTaskClick = () => {
        setSearchParams({ task: task.id })
    }

    const toggleStatus = (e?: React.MouseEvent | React.TouchEvent) => {
        e?.stopPropagation()
        updateTask({ taskId: task.id, updates: { is_completed: !task.is_completed } })
    }

    const setQuickDate = (days: number) => {
        const date = new Date()
        date.setDate(date.getDate() + days)
        const dateStr = date.toISOString().split('T')[0]
        updateTask({ taskId: task.id, updates: { due_date: dateStr } })
    }

    const handleCustomDate = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value
        if (date) {
            updateTask({ taskId: task.id, updates: { due_date: date } })
            // Optional: trigger time picker after date? 
            setTimeout(() => timeInputRef.current?.showPicker(), 300)
        }
    }

    const handleCustomTime = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = e.target.value
        if (time && task.due_date) {
            const [year, month, day] = (task.due_date as string).split('T')[0].split('-')
            const newDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            const [hours, minutes] = time.split(':')
            newDate.setHours(parseInt(hours), parseInt(minutes))
            updateTask({ taskId: task.id, updates: { start_time: newDate.toISOString() } })
        }
    }

    const leadingActions = () => (
        <LeadingActions>
            {/* Tag 1 Quick Action */}
            {allTags?.slice(0, 2).map(tag => {
                const isAttached = taskTags?.some(t => t.id === tag.id)
                return (
                    <SwipeAction key={tag.id} onClick={() => toggleTag({ taskId: task.id, tagId: tag.id, isAttached: !!isAttached })}>
                        <div
                            className="flex flex-col items-center justify-center px-4 h-full text-white transition-all min-w-[70px]"
                            style={{ backgroundColor: tag.color }}
                        >
                            <Tag size={20} className={clsx(isAttached && "fill-current")} />
                            <span className="text-[10px] uppercase font-bold mt-1 truncate max-w-[60px]">{tag.name}</span>
                        </div>
                    </SwipeAction>
                )
            })}
            {/* More Tags / Manager */}
            <SwipeAction onClick={() => handleTaskClick()}>
                <div className="flex flex-col items-center justify-center px-4 bg-gray-400 text-white h-full min-w-[70px]">
                    <MoreHorizontal size={20} />
                    <span className="text-[10px] uppercase font-bold mt-1">Tags</span>
                </div>
            </SwipeAction>
        </LeadingActions>
    )

    const trailingActions = () => (
        <TrailingActions>
            {/* Custom Date Picker */}
            <SwipeAction onClick={() => dateInputRef.current?.showPicker()}>
                <div className="flex flex-col items-center justify-center px-4 bg-purple-500 text-white h-full min-w-[70px]">
                    <Clock size={20} />
                    <span className="text-[10px] uppercase font-bold mt-1">Pick</span>
                </div>
            </SwipeAction>

            {/* Tomorrow */}
            <SwipeAction onClick={() => setQuickDate(1)}>
                <div className="flex flex-col items-center justify-center px-4 bg-blue-500 text-white h-full min-w-[70px]">
                    <ArrowRight size={20} />
                    <span className="text-[10px] uppercase font-bold mt-1">Tom</span>
                </div>
            </SwipeAction>

            {/* Today */}
            <SwipeAction onClick={() => setQuickDate(0)}>
                <div className="flex flex-col items-center justify-center px-4 bg-green-500 text-white h-full min-w-[70px]">
                    <Sun size={20} />
                    <span className="text-[10px] uppercase font-bold mt-1">Today</span>
                </div>
            </SwipeAction>
        </TrailingActions>
    )

    return (
        <div className="mb-2 relative">
            {/* Hidden native pickers to be triggered from swipe */}
            <input
                type="date"
                ref={dateInputRef}
                className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
                onChange={handleCustomDate}
            />
            <input
                type="time"
                ref={timeInputRef}
                className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
                onChange={handleCustomTime}
            />

            <SwipeableList threshold={0.5} type={SwipeType.IOS}>
                <SwipeableListItem
                    leadingActions={leadingActions()}
                    trailingActions={trailingActions()}
                >
                    <div
                        onClick={handleTaskClick}
                        className={clsx(
                            "flex items-center p-3 border rounded-lg transition-colors group cursor-pointer bg-white w-full",
                            isActive ? "bg-blue-50 border-blue-200" : "border-gray-100 hover:bg-gray-50"
                        )}
                    >
                        {/* Drag Handle - only visible/active on desktop or specifically for drag */}
                        <div
                            {...listeners}
                            {...attributes}
                            className="mr-2 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-2 -ml-2"
                            style={{ touchAction: 'none' }}
                            onPointerDown={e => e.stopPropagation()} // Important to stop parent click/swipe if we drag
                        >
                            <GripVertical size={20} />
                        </div>

                        <button
                            onClick={(e) => toggleStatus(e)}
                            className={clsx("mr-1 p-2 -ml-1 transition-colors", task.is_completed ? "text-green-500" : "text-gray-400")}
                        >
                            {task.is_completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className={clsx("font-medium truncate", task.is_completed ? "text-gray-400 line-through" : "text-gray-700")}>
                                    {task.title}
                                </div>
                                <div className="flex items-center gap-1">
                                    {task.tags?.map((tag: any) => (
                                        <div key={tag.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} title={tag.name} />
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs mt-0.5">
                                {task.due_date && (
                                    <span className={clsx(
                                        new Date(task.due_date) < new Date() && !task.is_completed ? "text-red-500 font-medium" : "text-gray-400"
                                    )}>
                                        {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                )}
                                {task.start_time && (
                                    <span className="text-gray-400">
                                        {new Date(task.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </SwipeableListItem>
            </SwipeableList>
        </div>
    )
}
