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
    const recognitionRef = useRef<any>(null)

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
        } catch (err) {
            console.error('Failed to start speech recognition:', err)
        }
    }, [isListening])

    const stopListening = useCallback(() => {
        if (!recognitionRef.current || !isListening) return

        try {
            recognitionRef.current.stop()
            setIsListening(false)
        } catch (err) {
            console.error('Failed to stop speech recognition:', err)
        }
    }, [isListening])

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
            let finalTranscript = ''
            let interimTranscript = ''

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript
                } else {
                    interimTranscript += event.results[i][0].transcript
                }
            }

            // Prefer final, but send interim if available
            // Note: simple implementation sends raw text chunks
            const text = finalTranscript || interimTranscript
            if (text && onResultRef.current) {
                onResultRef.current({
                    transcript: text,
                    isFinal: !!finalTranscript
                })
            }
        }

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error)
            setError(event.error)
            setIsListening(false)
        }

        recognition.onend = () => {
            setIsListening(false)
        }

        return () => {
            // Cleanup handled by useEffect return
        }
    }, [])

    // Safety Force stop on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
        }
    }, [])

    return {
        isListening,
        error,
        startListening,
        stopListening,
        toggleListening,
        hasSupport: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    }
}
