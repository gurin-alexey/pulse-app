import { useState, useEffect, useRef, useCallback } from 'react'

type SpeechToTextOptions = {
    interimResults?: boolean
    lang?: string
}

type SpeechToTextResult = {
    transcript: string
    isFinal: boolean
}

export function useSpeechToText(options: SpeechToTextOptions = {}) {
    const [isListening, setIsListening] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [remainingTime, setRemainingTime] = useState(3)

    const recognitionRef = useRef<any>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Callback to deliver results
    const onResultRef = useRef<((result: SpeechToTextResult) => void) | null>(null)

    useEffect(() => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition()
            recognitionRef.current.continuous = true
            recognitionRef.current.interimResults = options.interimResults ?? true
            recognitionRef.current.lang = options.lang || 'ru-RU'
        }
    }, [options.interimResults, options.lang])

    const stopListening = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
        if (!recognitionRef.current) return

        try {
            recognitionRef.current.stop()
        } catch (err) {
            console.error('Failed to stop speech recognition:', err)
        }
        setIsListening(false)
        setRemainingTime(3)
    }, [])

    const resetSilenceTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
        }
        setRemainingTime(3)

        intervalRef.current = setInterval(() => {
            setRemainingTime(prev => {
                if (prev <= 1) {
                    stopListening()
                    return 3
                }
                return prev - 1
            })
        }, 1000)
    }, [stopListening])

    const startListening = useCallback((onResult: (result: SpeechToTextResult) => void) => {
        if (!recognitionRef.current) {
            setError('Speech recognition not supported in this browser.')
            return
        }

        if (isListening) return

        setError(null)
        onResultRef.current = onResult

        try {
            recognitionRef.current.start()
            setIsListening(true)
            resetSilenceTimer()
        } catch (err) {
            console.error('Failed to start speech recognition:', err)
        }
    }, [isListening, resetSilenceTimer])

    const toggleListening = useCallback((onResult: (result: SpeechToTextResult) => void) => {
        if (isListening) {
            stopListening()
        } else {
            startListening(onResult)
        }
    }, [isListening, startListening, stopListening])

    useEffect(() => {
        if (!recognitionRef.current) return
        const recognition = recognitionRef.current

        recognition.onresult = (event: any) => {
            resetSilenceTimer()

            let finalTranscript = ''
            let interimTranscript = ''

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript
                } else {
                    interimTranscript += event.results[i][0].transcript
                }
            }

            // Simplified: grab the last result
            const rawText = finalTranscript || interimTranscript
            // Or get text from the interim results if provided
            const text = event.results[event.results.length - 1][0].transcript

            if (text && onResultRef.current) {
                onResultRef.current({
                    transcript: text,
                    isFinal: event.results[event.results.length - 1].isFinal
                })
            }
        }

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error)
            setError(event.error)
            setIsListening(false)
            if (intervalRef.current) clearInterval(intervalRef.current)
        }

        recognition.onend = () => {
            setIsListening(false)
            if (intervalRef.current) clearInterval(intervalRef.current)
        }

        return () => {
            // Cleanup handled by useEffect return
        }
    }, [resetSilenceTimer])

    // Safety Force stop on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [])

    return {
        isListening,
        error,
        startListening,
        stopListening,
        toggleListening,
        remainingTime,
        hasSupport: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    }
}
