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

    // Track if drawer was fully expanded to enable direct close on swipe down
    const wasFullyExpandedRef = React.useRef(false)

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)
        if (!open) {
            // Reset state for next open
            wasFullyExpandedRef.current = false
            setSnapPoints([0.55, 1])
            setSnap(0.55)

            // Wait for animation to finish before unmounting (calling onClose)
            setTimeout(() => {
                onClose()
            }, 300)
        }
    }

    // Controlled snap state
    const [snap, setSnap] = React.useState<number | string | null>(0.55)

    // Dynamic snap points:
    // Initial: [0.55, 1]
    // Once expanded to 1, we remove 0.55 so swiping down closes immediately.
    const [snapPoints, setSnapPoints] = React.useState<(number | string)[]>([0.55, 1])

    // Effect to remove 0.55 when fully expanded
    React.useEffect(() => {
        if (snap === 1 && !wasFullyExpandedRef.current) {
            wasFullyExpandedRef.current = true
            // Small delay to ensure the snap animation completes before changing points
            const timer = setTimeout(() => {
                setSnapPoints([1])
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [snap])

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

    // Mobile: Vaul Drawer
    return (
        <Drawer.Root
            open={isOpen}
            onOpenChange={handleOpenChange}
            snapPoints={snapPoints}
            activeSnapPoint={snap}
            setActiveSnapPoint={setSnap}
            fadeFromIndex={0}
            closeThreshold={0.2}
            scrollLockTimeout={100}
        >
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50" />
                <Drawer.Content
                    className="bg-white flex flex-col rounded-t-[10px] fixed bottom-0 left-0 right-0 h-[96dvh] z-50 focus:outline-none"
                    onFocusCapture={(e) => {
                        // When input is focused (keyboard opens), expand to full screen
                        // Check if it's an input or textarea
                        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                            setSnap(1)
                        }
                    }}
                >
                    {/* Drag Handle - larger area for easier grabbing */}
                    <div
                        className="w-full flex justify-center py-3 cursor-grab active:cursor-grabbing"
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
