import { useSpeechToText } from '@/hooks/useSpeechToText'
import { Mic } from 'lucide-react'
import clsx from 'clsx'

type VoiceInputButtonProps = {
    onTranscription: (text: string) => void
    className?: string
    iconSize?: number
}

export function VoiceInputButton({ onTranscription, className, iconSize = 16 }: VoiceInputButtonProps) {
    const { isListening, toggleListening, hasSupport } = useSpeechToText({ interimResults: true })

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
                "transition-colors",
                isListening ? "text-red-500 animate-pulse" : "",
                className
            )}
            title="Dictate"
        >
            <Mic size={iconSize} className={clsx(isListening && "fill-current")} />
        </button>
    )
}
