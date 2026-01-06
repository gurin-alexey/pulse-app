import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export type ChatMessage = {
    role: 'user' | 'assistant' | 'system'
    content: string
}

export type AIProvider = 'openai' | 'gemini'

export function useAIChat(apiKey: string | null, provider: AIProvider, model: string, systemContext?: string) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const sendMessage = async (content: string) => {
        setIsLoading(true)
        setError(null)

        const userMsg: ChatMessage = { role: 'user', content }
        setMessages(prev => [...prev, userMsg])

        // Prepare context message
        let systemPrompt = "Ты — помощник по продуктивности. Твои ответы кратки и мотивируют действовать."
        if (systemContext) {
            systemPrompt += `\n\nКОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:\n${systemContext}\n\nИспользуй этот контекст, чтобы отвечать на вопросы о задачах и проектах пользователя.`
        }

        try {
            let aiContent = ""
            const cleanMessages = messages.concat(userMsg).filter(m => m.role !== 'system')

            if (!apiKey) {
                // --- Server Mode (Supabase Edge Function) ---
                console.log("Using Server Mode (Supabase Edge Function)...")

                const { data, error } = await supabase.functions.invoke('chat-stream', {
                    body: {
                        messages: cleanMessages,
                        provider,
                        model,
                        systemPrompt
                    }
                })

                if (error) {
                    throw new Error(error.message || "Ошибка вызова Supabase Function")
                }

                if (data?.error) {
                    throw new Error(data.error)
                }

                aiContent = data.content || "No response from server"

            } else {
                // --- Client Mode (Direct API Call) ---
                if (provider === 'gemini') {
                    // --- Google Gemini API ---
                    // Using gemini-2.0-flash based on user's available models list
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: cleanMessages.map(m => ({
                                role: m.role === 'user' ? 'user' : 'model',
                                parts: [{ text: m.content }]
                            })),
                            systemInstruction: {
                                parts: [{ text: systemPrompt }]
                            },
                            generationConfig: {
                                maxOutputTokens: 1000,
                            }
                        })
                    })

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}))
                        let errorMessage = errorData?.error?.message || response.statusText || "Unknown error"

                        // Auto-debug: If 404, check what models ARE available
                        if (response.status === 404) {
                            try {
                                const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
                                if (modelsResponse.ok) {
                                    const modelsData = await modelsResponse.json()
                                    const availableModels = modelsData.models?.map((m: any) => m.name.replace('models/', '')).join(', ')
                                    errorMessage += `\n\nДОСТУПНЫЕ МОДЕЛИ:\n${availableModels}`
                                }
                            } catch (e) {
                                errorMessage += " (Не удалось получить список моделей)"
                            }
                        }

                        throw new Error(`Gemini Error ${response.status}: ${errorMessage}`)
                    }

                    const data = await response.json()
                    aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response"

                } else {
                    // --- OpenAI API (Default) ---
                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: model || 'gpt-3.5-turbo',
                            messages: [
                                { role: "system", content: systemPrompt },
                                ...cleanMessages
                            ],
                            max_tokens: 1000
                        })
                    })

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}))
                        const errorMessage = errorData?.error?.message || response.statusText || "Unknown error"
                        throw new Error(`OpenAI Error ${response.status}: ${errorMessage}`)
                    }

                    const data = await response.json()
                    aiContent = data.choices[0]?.message?.content || "No response"
                }
            }

            setMessages(prev => [...prev, { role: 'assistant', content: aiContent }])

        } catch (err: any) {
            console.error("AI Chat Error:", err);

            let errorMessage = err.message || "Неизвестная ошибка";

            // Handle network errors specifically
            if (errorMessage.includes("Failed to fetch")) {
                errorMessage = "Ошибка сети (VPN?). Проверьте интернет или включите VPN.";
            } else if (errorMessage.includes("401")) {
                errorMessage = "Неверный API ключ (401).";
            } else if (errorMessage.includes("429")) {
                errorMessage = "Лимит запросов исчерпан (429).";
            } else if (errorMessage.includes("FunctionsFetchError")) {
                errorMessage = "Ошибка соединения с сервером (Edge Function).";
            }

            setError(errorMessage)
            setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errorMessage}` }])
        } finally {
            setIsLoading(false)
        }
    }

    const clearHistory = () => setMessages([])

    return { messages, isLoading, error, sendMessage, clearHistory }
}
