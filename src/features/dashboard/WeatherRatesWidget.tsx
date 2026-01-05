import { CloudSun, TrendingUp, DollarSign } from "lucide-react"

export function WeatherRatesWidget() {
    return (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <CloudSun size={24} className="text-yellow-500" />
                    <div>
                        <div className="text-2xl font-bold text-gray-800">-5°C</div>
                        <div className="text-xs text-gray-400 font-medium">Moscow, Clear</div>
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-green-50 text-green-600 rounded">
                        <DollarSign size={14} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-700">92.40</div>
                        <div className="text-[10px] text-gray-400">USD/RUB</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                        <TrendingUp size={14} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-700">3,140</div>
                        <div className="text-[10px] text-gray-400">S&P 500</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
