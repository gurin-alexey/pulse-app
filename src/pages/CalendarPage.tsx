import { useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { Calendar } from "@/features/calendar/Calendar"

export function CalendarPage() {
    const navigate = useNavigate()

    const headerLeft = (
        <button
            onClick={() => navigate('/')}
            className="group flex items-center gap-0 hover:gap-2 p-3 hover:px-4 text-sm font-medium text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all duration-200 shadow-sm z-10"
            title="Свернуть календарь"
        >
            <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[140px] transition-all duration-200 font-medium">
                Свернуть календарь
            </span>
            <ArrowRight size={22} className="shrink-0" />
        </button>
    )

    return (
        <Calendar
            initialView="timeGridWeek"
            enableSwipe={true}
            headerLeft={headerLeft}
            className="p-0 md:p-4"
        />
    )
}
