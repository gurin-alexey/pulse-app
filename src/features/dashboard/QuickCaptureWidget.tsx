import { useState, useEffect } from "react"
import { useCreateTask } from "@/hooks/useCreateTask"
import { supabase } from "@/lib/supabase"
import { Plus, X, Save } from "lucide-react"
import { toast } from "sonner"
import clsx from "clsx"

export function QuickCaptureWidget() {
    const [text, setText] = useState("")
    const { mutate: createTask, isPending } = useCreateTask()
    const [userId, setUserId] = useState<string | null>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setUserId(data.user.id)
        })
    }, [])

    // Load from local storage
    useEffect(() => {
        const saved = localStorage.getItem('dashboard_scratchpad')
        if (saved) setText(saved)
    }, [])

    // Auto-save to local storage (debounce 500ms)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            localStorage.setItem('dashboard_scratchpad', text)
        }, 500)
        return () => clearTimeout(timeoutId)
    }, [text])

    const handleSave = () => {
        if (!text.trim()) return
        if (!userId) {
            toast.error("User not found")
            return
        }

        createTask({
            title: text,
            userId: userId,
            projectId: null, // Inbox
            priority: 'medium'
        }, {
            onSuccess: () => {
                toast.success("Saved to Inbox")
                setText("")
                localStorage.removeItem('dashboard_scratchpad')
            },
            onError: () => {
                toast.error("Failed to save task")
            }
        })
    }

    const handleClear = () => {
        if (confirm("Clear this note?")) {
            setText("")
            localStorage.removeItem('dashboard_scratchpad')
        }
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400 z-10" />

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Запиши идею, пока не улетела..."
                className="flex-1 w-full p-4 resize-none outline-none border-none bg-yellow-50/50 text-gray-700 placeholder:text-gray-400/70 text-base leading-relaxed"
                spellCheck={false}
            />

            <div className="flex items-center justify-between p-2 bg-white/50 border-t border-gray-100 backdrop-blur-sm">
                <button
                    onClick={handleClear}
                    disabled={!text}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Clear"
                >
                    <X size={18} />
                </button>

                <span className="text-xs text-gray-300 font-medium px-2">
                    {text ? "Saving..." : "Quick Note"}
                </span>

                <button
                    onClick={handleSave}
                    disabled={!text || isPending}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm hover:shadow"
                >
                    {isPending ? <Save size={16} className="animate-pulse" /> : <Plus size={16} />}
                    To Inbox
                </button>
            </div>
        </div>
    )
}
