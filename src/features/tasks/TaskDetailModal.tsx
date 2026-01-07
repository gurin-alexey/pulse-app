import React from 'react'
import { TaskDetail } from "@/features/tasks/TaskDetail"
import clsx from "clsx"
import { Drawer } from "vaul"
import { useMediaQuery } from "@/hooks/useMediaQuery"

export function TaskDetailModal({ taskId, onClose }: { taskId: string, onClose: () => void }) {
    // Simple media query for mobile check
    const isMobile = useMediaQuery("(max-width: 768px)")

    if (!taskId) return null

    // Desktop: Standard Centered Modal (Existing Logic)
    if (!isMobile) {
        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-150"
                onClick={onClose}
            >
                <div
                    className="bg-white shadow-2xl w-full max-w-2xl max-h-[85vh] rounded-2xl animate-in zoom-in-95 duration-150 flex flex-col relative overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex-1 overflow-y-auto">
                        <TaskDetail taskId={taskId} />
                    </div>
                </div>
            </div>
        )
    }

    // Mobile: Vaul Drawer
    return (
        <Drawer.Root open={true} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50" />
                <Drawer.Content className="bg-white flex flex-col rounded-t-[10px] fixed bottom-0 left-0 right-0 top-[50vh] z-50 focus:outline-none">
                    {/* Drag Handle */}
                    <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mt-4 mb-2" />

                    <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
                        <TaskDetail taskId={taskId} />
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}



