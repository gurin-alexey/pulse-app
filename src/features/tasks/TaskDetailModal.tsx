import { TaskDetail } from "@/features/tasks/TaskDetail"

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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 transition-all duration-300 animate-in fade-in"
            onClick={handleBackdropClick}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out">
                <div className="flex-1 overflow-y-auto">
                    <TaskDetail taskId={taskId} />
                </div>
            </div>
        </div>
    )
}
