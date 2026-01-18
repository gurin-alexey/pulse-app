import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { supabase } from '@/lib/supabase'
import { useSubtasks } from '@/hooks/useSubtasks'
import { useCreateTask } from '@/hooks/useCreateTask'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskItem } from './TaskItem'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import clsx from 'clsx'

function SortableSubtaskItem({ task, isMobile }: { task: any, isMobile: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: task.id, data: { task, type: 'Task' } })

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 0 : 'auto'
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                "touch-none rounded-md transition-all",
                isDragging && "bg-blue-50/20 outline outline-2 outline-dashed outline-blue-300 -outline-offset-2"
            )}
        >
            <div className={isDragging ? "opacity-0" : ""}>
                <TaskItem
                    task={task}
                    isActive={isDragging}
                    listeners={listeners}
                    attributes={attributes}
                    isSubtaskMode={true}
                    isMobile={isMobile}
                />
            </div>
        </div>
    )
}

import { useUpdateTask } from '@/hooks/useUpdateTask'

// ... existing imports ...

export function SubtaskList({ taskId, projectId, isProject }: { taskId: string; projectId: string | null; isProject: boolean }) {
    const { data: subtasks, isLoading } = useSubtasks(taskId)
    const { mutate: createTask } = useCreateTask()
    const { mutate: updateTask } = useUpdateTask()
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
    const isMobile = useMediaQuery("(max-width: 768px)")

    const completedCount = subtasks?.filter(t => t.is_completed).length || 0
    const totalCount = subtasks?.length || 0
    const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)

    const handleAddSubtask = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newSubtaskTitle.trim()) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        createTask({
            title: newSubtaskTitle.trim(),
            projectId, // Subtask belongs to the same project
            userId: user.id,
            parentId: taskId
        }, {
            onSuccess: () => {
                setNewSubtaskTitle('')
                if (!isProject) {
                    updateTask({ taskId, updates: { is_project: true } })
                }
            }
        })
    }

    if (isLoading) return <div className="p-4"><Loader2 className="animate-spin w-4 h-4 text-gray-400" /></div>

    const sortedSubtasks = subtasks?.sort((a, b) => {
        if (a.is_completed && !b.is_completed) return 1
        if (!a.is_completed && b.is_completed) return -1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }) || []

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Subtasks</h3>
                <span className="text-xs text-gray-500">{completedCount}/{totalCount}</span>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div
                    className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* List */}
            <div className="space-y-1">
                <SortableContext
                    items={sortedSubtasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {sortedSubtasks.map(subtask => (
                        <SortableSubtaskItem key={subtask.id} task={subtask} isMobile={isMobile} />
                    ))}
                </SortableContext>
            </div>

            {/* Input */}
            <form onSubmit={handleAddSubtask} className="mt-2 text-sm flex items-center text-gray-400 hover:text-gray-600 pl-2">
                <Plus size={16} className="mr-3" />
                <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add a subtask..."
                    className="flex-1 bg-transparent outline-none placeholder:text-gray-400 text-gray-700 py-1"
                />
            </form>
        </div>
    )
}
