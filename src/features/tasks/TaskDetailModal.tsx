import { X } from "lucide-react"
import { TaskDetail } from "@/features/tasks/TaskDetail"

interface TaskDetailModalProps {
    taskId: string
    onClose: () => void
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
    if (!taskId) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 z-10 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex-1 overflow-y-auto">
                    <TaskDetail taskId={taskId} />
                </div>
            </div>
        </div>
    )
}
