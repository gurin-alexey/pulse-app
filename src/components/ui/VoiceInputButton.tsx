import { useSpeechToText } from '@/hooks/useSpeechToText'
import { Mic } from 'lucide-react'
import clsx from 'clsx'

type VoiceInputButtonProps = {
    onTranscription: (text: string) => void
    onRecordingComplete?: () => void
    className?: string
    iconSize?: number
}

import { useEffect, useRef } from 'react'

export function VoiceInputButton({ onTranscription, onRecordingComplete, className, iconSize = 16 }: VoiceInputButtonProps) {
    const { isListening, toggleListening, hasSupport, remainingTime } = useSpeechToText({ interimResults: true })
    const wasListening = useRef(false)

    useEffect(() => {
        if (wasListening.current && !isListening) {
            onRecordingComplete?.()
        }
        wasListening.current = isListening
    }, [isListening, onRecordingComplete])

    const handleClick = () => {
        toggleListening((result) => {
            if (result.isFinal) {
                onTranscription(result.transcript)
            }
        })
    }

    if (!hasSupport) return null

    return (
        <button
            type="button"
            onClick={handleClick}
            className={clsx(
                "transition-all flex items-center justify-center relative",
                isListening ? "text-red-500 bg-red-50 rounded-full p-1.5 shadow-sm ring-1 ring-red-100" : "hover:bg-gray-100 rounded-full p-1",
                className
            )}
            title="Dictate"
        >
            <Mic size={isListening ? iconSize + 2 : iconSize} className={clsx(isListening && "fill-current animate-pulse")} />
            {isListening && (
                <span className="absolute -bottom-1 -right-1 text-[10px] font-bold bg-white text-red-600 border border-red-100 rounded-full w-3.5 h-3.5 flex items-center justify-center shadow-sm leading-none">
                    {remainingTime}
                </span>
            )}
        </button>
    )
}
