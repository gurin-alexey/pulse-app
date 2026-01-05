import { useNavigate, useSearchParams } from "react-router-dom"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { CheckCircle2, Circle, GripVertical } from "lucide-react"
import { useTags, useToggleTaskTag, useTaskTags } from '@/hooks/useTags'
import clsx from "clsx"
import { motion } from "framer-motion"

interface TaskItemProps {
    task: any
    isActive: boolean
    depth?: number
    listeners?: any
    attributes?: any
}

export function TaskItem({ task, isActive, depth = 0, listeners, attributes }: TaskItemProps) {
    // ... existing hooks ...
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { mutate: updateTask } = useUpdateTask()
    const { data: allTags } = useTags()
    const { data: taskTags } = useTaskTags(task.id)
    const { mutate: toggleTag } = useToggleTaskTag()

    const handleTaskClick = () => {
        setSearchParams({ task: task.id })
    }

    const toggleStatus = (e?: React.MouseEvent | React.TouchEvent) => {
        e?.stopPropagation()
        updateTask({ taskId: task.id, updates: { is_completed: !task.is_completed } })
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="mb-2 relative"
            style={{ marginLeft: `${depth * 24}px` }}
        >
            <div
                onClick={handleTaskClick}
                className={clsx(
                    "flex items-center p-3 border rounded-lg transition-colors group cursor-pointer bg-white w-full shadow-sm",
                    isActive ? "bg-blue-50 border-blue-200" : "border-gray-100 hover:bg-gray-50",
                    task.is_completed && "opacity-60"
                )}
            >
                {/* Drag Handle - always rendered but functionality depends on parent dnd context */}
                <div
                    {...listeners}
                    {...attributes}
                    className={clsx(
                        "mr-2 p-2 -ml-2 touch-none transition-colors",
                        "cursor-move active:cursor-grabbing",
                        isActive ? "text-blue-600" : "text-gray-500 group-hover:text-gray-700"
                    )}
                    onPointerDown={e => {
                        listeners?.onPointerDown?.(e)
                        e.stopPropagation()
                    }}
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
        </motion.div>
    )
}
