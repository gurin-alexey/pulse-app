import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useTasks } from "@/hooks/useTasks"
import { Sun, Calendar } from "lucide-react"

export function GreetingWidget() {
    const [userName, setUserName] = useState("Friend")
    const { data: todayTasks } = useTasks({ type: 'today' })

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user?.email) {
                setUserName(data.user.email.split('@')[0])
            }
        })
    }, [])

    const hours = new Date().getHours()
    const greeting = hours < 12 ? "Good morning" : hours < 18 ? "Good afternoon" : "Good evening"

    return (
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden h-full flex flex-col justify-center">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-900/10 rounded-full blur-xl -ml-5 -mb-5" />

            <div className="relative z-10">
                <div className="flex items-center gap-2 text-blue-100 mb-2 font-medium text-sm">
                    <Sun size={16} /> <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                </div>
                <h2 className="text-3xl font-bold mb-1">{greeting}, {userName}.</h2>
                <p className="text-blue-100/90 text-lg">
                    You have <strong className="text-white font-bold">{todayTasks?.filter(t => !t.is_completed).length || 0} tasks</strong> scheduled for today.
                </p>
            </div>
        </div>
    )
}
