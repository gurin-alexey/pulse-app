import { Play, Pause, StopCircle, RefreshCcw, Timer } from 'lucide-react'
import { clsx } from 'clsx'
import { useTimerStore } from '@/store/useTimerStore'

export function TimerBanner({ taskId }: { taskId: string }) {
    const { taskId: activeTaskId, status, timeLeft, start, pause, resume, stop } = useTimerStore()

    const isActive = activeTaskId === taskId
    const isRunning = isActive && status === 'running'

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    if (!isActive) {
        return (
            <div className="mb-2 p-2 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between group">
                <div className="flex items-center gap-2 text-gray-500">
                    <Timer size={16} />
                    <span className="text-sm font-medium">Таймер Помодоро</span>
                </div>
                <button
                    onClick={() => start(taskId)}
                    className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-100 hover:text-blue-600 transition-colors shadow-sm"
                >
                    <Play size={12} className="fill-current" />
                    Старт (25м)
                </button>
            </div>
        )
    }

    // Show active timer controls
    return (
        <div className={clsx(
            "mb-2 p-3 border rounded-xl flex items-center justify-between transition-all",
            isRunning ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"
        )}>
            <div className={clsx("flex items-center gap-3", isRunning ? "text-red-700" : "text-amber-700")}>
                <div className={clsx("p-2 rounded-full", isRunning ? "bg-red-100 animate-pulse" : "bg-amber-100")}>
                    <Timer size={20} />
                </div>
                <div>
                    <div className="text-2xl font-bold font-mono leading-none tracking-tight">
                        {formatTime(timeLeft)}
                    </div>
                    <div className="text-xs opacity-75 font-medium mt-0.5">
                        {isRunning ? 'Фокусировка...' : 'Пауза'}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1">
                {isRunning ? (
                    <button
                        onClick={pause}
                        className="p-2 bg-white/80 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                        title="Pause"
                    >
                        <Pause size={18} className="fill-current" />
                    </button>
                ) : (
                    <button
                        onClick={resume}
                        className="p-2 bg-white/80 border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors shadow-sm"
                        title="Resume"
                    >
                        <Play size={18} className="fill-current" />
                    </button>
                )}

                <button
                    onClick={stop}
                    className={clsx(
                        "p-2 bg-white/80 border rounded-lg transition-colors shadow-sm hover:opacity-80",
                        isRunning ? "border-red-200 text-red-600 hover:bg-red-50" : "border-amber-200 text-amber-600 hover:bg-amber-50"
                    )}
                    title="Stop"
                >
                    <StopCircle size={18} />
                </button>
                <button
                    onClick={() => start(taskId)}
                    className="p-2 ml-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Restart"
                >
                    <RefreshCcw size={16} />
                </button>
            </div>
        </div>
    )
}
