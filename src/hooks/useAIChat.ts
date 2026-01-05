import { useState } from 'react'

export type ChatMessage = {
    role: 'user' | 'assistant'
    content: string
}

export function useAIChat(apiKey: string | null) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const sendMessage = async (content: string) => {
        setIsLoading(true)
        setError(null)

        const userMsg: ChatMessage = { role: 'user', content }
        setMessages(prev => [...prev, userMsg])

        try {
            if (!apiKey) {
                // Mock response
                await new Promise(resolve => setTimeout(resolve, 1000))
                const responses = [
                    "Отличная идея! Давай разобьем это на шаги.",
                    "Не забывай про приоритеты. Что важнее всего сейчас?",
                    "Звучит как план. Я добавил бы тайм-боксинг для этой задачи.",
                    "Фокусируйся на 20% усилий, которые дают 80% результата.",
                    "Сделано лучше, чем идеально. Действуй!"
                ]
                const randomResponse = responses[Math.floor(Math.random() * responses.length)]
                setMessages(prev => [...prev, { role: 'assistant', content: randomResponse }])
            } else {
                // Real API Call
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: "gpt-3.5-turbo",
                        messages: [
                            { role: "system", content: "Ты — помощник по продуктивности. Твои ответы кратки и мотивируют действовать." },
                            ...messages,
                            userMsg
                        ],
                        max_tokens: 150
                    })
                })

                if (!response.ok) {
                    throw new Error(`API Error: ${response.statusText}`)
                }

                const data = await response.json()
                const aiContent = data.choices[0]?.message?.content || "No response"

                setMessages(prev => [...prev, { role: 'assistant', content: aiContent }])
            }

        } catch (err: any) {
            setError(err.message)
            setMessages(prev => [...prev, { role: 'assistant', content: "Извини, я устал. Попробуй позже." }])
        } finally {
            setIsLoading(false)
        }
    }

    const clearHistory = () => setMessages([])

    return { messages, isLoading, error, sendMessage, clearHistory }
}
