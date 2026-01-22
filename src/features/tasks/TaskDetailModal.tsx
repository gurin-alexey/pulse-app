import React from 'react'
import { TaskDetail } from "@/features/tasks/TaskDetail"
import clsx from "clsx"
import { Drawer } from "vaul"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useSearchParams } from "react-router-dom"
import { X } from 'lucide-react'

export function TaskDetailModal({ taskId, onClose }: { taskId: string, onClose: () => void }) {
    // Simple media query for mobile check
    const isMobile = useMediaQuery("(max-width: 768px)")
    const [isOpen, setIsOpen] = React.useState(true)

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)
        if (!open) {
            // Wait for animation to finish before unmounting (calling onClose)
            setTimeout(() => {
                onClose()
            }, 300)
        }
    }

    const [searchParams] = useSearchParams()
    const isNew = searchParams.get('isNew') === 'true'

    if (!taskId) return null

    // Handle Escape key
    React.useEffect(() => {
        if (!isMobile) {
            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    onClose()
                }
            }
            window.addEventListener('keydown', handleEscape)
            return () => window.removeEventListener('keydown', handleEscape)
        }
    }, [isMobile, onClose])

    // Desktop: Always Center Modal
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
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 z-50 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex-1 overflow-y-auto pt-8">
                        <TaskDetail key={taskId} taskId={taskId} />
                    </div>
                </div>
            </div>
        )
    }

    // Mobile: Simple full-screen drawer without snap points
    return (
        <Drawer.Root
            open={isOpen}
            onOpenChange={handleOpenChange}
            closeThreshold={0.1}
        >
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[70]" />
                <Drawer.Content
                    className="bg-white flex flex-col rounded-t-[10px] fixed bottom-0 left-0 right-0 h-[100dvh] z-[70] focus:outline-none"
                >
                    {/* Drag Handle */}
                    <div
                        className="w-full flex justify-center py-4 cursor-grab active:cursor-grabbing"
                        style={{ touchAction: 'none' }}
                    >
                        <div className="w-12 h-1.5 rounded-full bg-gray-300" />
                    </div>

                    {/* Content area */}
                    <div
                        className="flex-1 overflow-y-auto"
                        style={{ overscrollBehavior: 'contain' }}
                    >
                        <TaskDetail key={taskId} taskId={taskId} />
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}

