import { useSelectionStore } from "@/store/useSelectionStore"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from '@/lib/supabase'
import { Trash2, CheckCircle2, X } from 'lucide-react'
import { toast } from "sonner"

export function BulkActionsPanel() {
    const { selectedIds, clear } = useSelectionStore()
    const queryClient = useQueryClient()

    if (selectedIds.size <= 1) return null

    const handleComplete = async () => {
        const ids = Array.from(selectedIds)

        const { error } = await supabase
            .from('tasks')
            .update({ is_completed: true })
            .in('id', ids)

        if (error) {
            console.error(error)
            toast.error("Failed to update tasks")
            return
        }

        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        queryClient.invalidateQueries({ queryKey: ['all-tasks'] })

        toast.success(`${ids.length} tasks completed`, {
            action: {
                label: "Undo",
                onClick: async () => {
                    await supabase.from('tasks').update({ is_completed: false }).in('id', ids)
                    queryClient.invalidateQueries({ queryKey: ['tasks'] })
                    queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
                }
            }
        })
        clear()
    }

    const handleDelete = async () => {
        const ids = Array.from(selectedIds)
        const timestamp = new Date().toISOString()

        const { error } = await supabase
            .from('tasks')
            .update({ deleted_at: timestamp })
            .in('id', ids)

        if (error) {
            console.error(error)
            toast.error("Failed to delete tasks")
            return
        }

        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        queryClient.invalidateQueries({ queryKey: ['all-tasks'] })

        toast.success(`${ids.length} tasks deleted`, {
            action: {
                label: "Undo",
                onClick: async () => {
                    await supabase.from('tasks').update({ deleted_at: null }).in('id', ids)
                    queryClient.invalidateQueries({ queryKey: ['tasks'] })
                    queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
                }
            }
        })
        clear()
    }

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
            <div className="mb-8 animate-in zoom-in-50 duration-200">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <span className="text-3xl font-bold text-blue-600">{selectedIds.size}</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">Tasks Selected</h2>
                <p className="text-sm text-gray-500 mt-1">Select an action below</p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                <button
                    onClick={handleComplete}
                    className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all gap-3 group"
                >
                    <CheckCircle2 size={32} className="text-gray-300 group-hover:text-green-500 transition-colors" />
                    <span className="font-semibold text-gray-600 group-hover:text-gray-900">Mark Complete</span>
                </button>

                <button
                    onClick={handleDelete}
                    className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:border-red-400 hover:shadow-lg hover:-translate-y-0.5 transition-all gap-3 group"
                >
                    <Trash2 size={32} className="text-gray-300 group-hover:text-red-500 transition-colors" />
                    <span className="font-semibold text-gray-600 group-hover:text-gray-900">Delete</span>
                </button>
            </div>

            <button
                onClick={clear}
                className="mt-12 flex items-center gap-2 px-6 py-2.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors font-medium"
            >
                <X size={18} />
                <span>Cancel Selection</span>
            </button>
        </div>
    )
}
