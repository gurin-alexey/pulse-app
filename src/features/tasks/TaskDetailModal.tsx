import { TaskDetail } from "@/features/tasks/TaskDetail"
import clsx from "clsx"

interface TaskDetailModalProps {
    taskId: string
    onClose: () => void
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
    if (!taskId) return null

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 md:p-4 transition-all duration-300 animate-in fade-in"
            onClick={handleBackdropClick}
        >
            <div
                className={clsx(
                    "bg-white shadow-2xl w-full flex flex-col relative overflow-hidden",
                    // Desktop styles
                    "md:max-w-2xl md:max-h-[85vh] md:rounded-2xl md:animate-in md:zoom-in-95",
                    // Mobile Bottom Sheet styles
                    "h-[80vh] rounded-t-2xl animate-in slide-in-from-bottom duration-300"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Mobile Drag Handle */}
                <div className="md:hidden w-full flex justify-center py-3 bg-white shrink-0 cursor-grab active:cursor-grabbing" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                </div>

                <div className="flex-1 overflow-y-auto">
                    <TaskDetail taskId={taskId} />
                </div>
            </div>
        </div>
    )
}
