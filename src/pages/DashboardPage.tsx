import { GreetingWidget } from "@/features/dashboard/GreetingWidget"
import { AIAssistantWidget } from "@/features/dashboard/AIAssistantWidget"
import { QuickCaptureWidget } from "@/features/dashboard/QuickCaptureWidget"
import { DeadlineTasksWidget } from "@/features/dashboard/DeadlineTasksWidget"
import { WeatherRatesWidget } from "@/features/dashboard/WeatherRatesWidget"
import { Plus, LayoutGrid } from "lucide-react"
import { toast } from "sonner"

export function DashboardPage() {
    return (
        <div className="h-full overflow-y-auto p-4 md:p-8 bg-gray-50/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Dashboard</h1>
                    <p className="text-gray-400 text-sm mt-1">Your personal command center</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => toast.info("Layout customization coming soon!")}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                        title="Edit Layout"
                    >
                        <LayoutGrid size={20} />
                    </button>
                    <button
                        onClick={() => toast.success("Widget Gallery opened (Mock)")}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 font-medium active:scale-95"
                    >
                        <Plus size={18} />
                        <span>Add Widget</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">

                {/* 1. Greeting (Top-Left) */}
                <div className="lg:col-span-2 h-[220px]">
                    <GreetingWidget />
                </div>

                {/* 2. AI Assistant (Center Column - Tall) */}
                <div className="lg:col-span-1 lg:row-span-2 h-[500px] lg:h-auto">
                    <AIAssistantWidget />
                </div>

                {/* 3. Quick Note (Top-Right) */}
                <div className="lg:col-span-1 h-[220px]">
                    <QuickCaptureWidget />
                </div>

                {/* 4. Tasks (Bottom-Left) */}
                <div className="lg:col-span-2 h-[300px]">
                    <DeadlineTasksWidget />
                </div>

                {/* 5. Weather (Bottom-Right) */}
                <div className="lg:col-span-1 h-[300px]">
                    <WeatherRatesWidget />
                </div>

            </div>
        </div>
    )
}
