import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Calendar } from '@/features/calendar/Calendar'

export function DailyPlanner() {
    const navigate = useNavigate()

    const headerLeft = (
        <div className="flex items-center gap-2">
            <button
                onClick={() => navigate('/calendar')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                title="Открыть полный календарь"
            >
                <ArrowLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">Календарь</h2>
        </div>
    )

    return (
        <div className="h-full flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden daily-planner-wrapper">
            <Calendar
                initialView="timeGridDay"
                enableSwipe={false}
                headerLeft={headerLeft}
                className="border-none"
            />
        </div>
    )
}
