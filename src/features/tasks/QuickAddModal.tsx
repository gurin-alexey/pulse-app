import { useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useCreateTask } from '@/hooks/useCreateTask'
import { Send, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type QuickAddModalProps = {
    isOpen: boolean
    onClose: () => void
}

export function QuickAddModal({ isOpen, onClose }: QuickAddModalProps) {
    const [title, setTitle] = useState('')
    const { mutate: createTask, isPending } = useCreateTask()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        createTask({ title, project_id: null }, { // Inbox by default
            onSuccess: () => {
                toast.success('Task created')
                setTitle('')
                onClose()
            },
            onError: () => {
                toast.error('Failed to create task')
            }
        })
    }

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />

            <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
                <DialogPanel className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <DialogTitle className="font-bold text-lg text-gray-900">New Task</DialogTitle>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="relative">
                        <div className="relative">
                            <input
                                autoFocus
                                type="text"
                                placeholder="What needs to be done?"
                                className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 placeholder-gray-400 outline-none transition-all"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />

                            <button
                                type="submit"
                                disabled={!title.trim() || isPending}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
                            >
                                {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    )
}
