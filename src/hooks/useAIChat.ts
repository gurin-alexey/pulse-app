import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useChatStore, type ChatMessage } from '@/store/useChatStore' // Use types from store

export type { ChatMessage } // Re-export for compatibility if files use it from here

export type AIProvider = 'openai' | 'gemini'

export type Tool = {
    name: string
    description: string
    parameters: any
    execute: (args: any) => Promise<any>
}

export function useAIChat(
    apiKey: string | null,
    provider: AIProvider,
    model: string,
    systemContext?: string,
    tools: Tool[] = []
) {
    // Use Global Store
    const { messages, setMessages, addMessage, clearMessages } = useChatStore()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const sendMessage = async (content: string) => {
        setIsLoading(true)
        setError(null)

        const userMsg: ChatMessage = { role: 'user', content }
        // setMessages(prev => [...prev, userMsg]) -> replaced by addMessage
        addMessage(userMsg)

        // Prepare context message
        let systemPrompt = "Ты — умный помощник по управлению задачами (Pulse App). Твоя главная цель — помогать пользователю управлять его делами."
        systemPrompt += "\n\nВАЖНО: Если пользователь просит создать, добавить или запланировать задачу — ты ОБЯЗАН использовать инструмент `create_task`. Не отвечай просто текстом, что ты 'записал' или 'понял'. Сначала вызови функцию, дождись подтверждения, а потом ответь."
        if (systemContext) {
            systemPrompt += `\n\nТЕКУЩИЙ КОНТЕКСТ:\n${systemContext}\n\nОпирайся на этот список при ответах.`
        }
        const todayStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        systemPrompt += `\nСегодня: ${todayStr}.`

        try {
            // MAX TURNS to prevent infinite loops (e.g. AI keeps calling tools)
            let turns = 0
            const MAX_TURNS = 5

            while (turns < MAX_TURNS) {
                turns++
                let aiResponseMsg: ChatMessage | null = null
                let toolCallsToExecute: any[] = []

                // Get fresh messages for context construction
                const currentHistory = useChatStore.getState().messages

                if (!apiKey) {
                    // --- SERVER MODE ---
                    console.log("Using Server Mode...")
                    const { data, error } = await supabase.functions.invoke('chat-stream', {
                        body: {
                            messages: currentHistory.filter(m => m.role !== 'function' && m.role !== 'tool'), // Simplify for server mode
                            provider,
                            model,
                            systemPrompt
                        }
                    })
                    if (error) throw new Error(error.message || "Server Error")
                    if (data?.error) throw new Error(data.error)

                    aiResponseMsg = { role: 'assistant', content: data.content || "No response" }
                    addMessage(aiResponseMsg)
                    break

                } else if (provider === 'gemini') {
                    // --- GEMINI API ---
                    const geminiTools = tools.length > 0 ? [{
                        function_declarations: tools.map(t => ({
                            name: t.name,
                            description: t.description,
                            parameters: t.parameters
                        }))
                    }] : undefined

                    const contents = currentHistory.map(m => {
                        if (m.role === 'user') return { role: 'user', parts: [{ text: m.content || '' }] }
                        if (m.role === 'assistant') {
                            if (m.tool_calls) {
                                // For gemini history, we might need to represent tool calls differently or skip if complex
                                // Simplified: if it has content, use it.
                                return { role: 'model', parts: [{ text: m.content || '' }] }
                            }
                            return { role: 'model', parts: [{ text: m.content || '' }] }
                        }
                        if (m.role === 'tool') {
                            return {
                                role: 'function',
                                parts: [{
                                    functionResponse: {
                                        name: m.name,
                                        response: { content: m.content }
                                    }
                                }]
                            }
                        }
                        // Default fallback
                        return { role: 'user', parts: [{ text: m.content || '' }] }
                    })

                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents,
                            tools: geminiTools,
                            systemInstruction: { parts: [{ text: systemPrompt }] },
                            generationConfig: { maxOutputTokens: 1000 }
                        })
                    })

                    if (!res.ok) throw new Error(`Gemini Error ${res.status}: ${res.statusText}`)
                    const data = await res.json()

                    const candidate = data.candidates?.[0]?.content
                    const parts = candidate?.parts || []

                    const functionCallPart = parts.find((p: any) => p.functionCall)

                    if (functionCallPart) {
                        const fc = functionCallPart.functionCall
                        toolCallsToExecute.push({
                            id: 'gemini_call',
                            name: fc.name,
                            args: fc.args
                        })

                        // Add assistant message with function call to history (locally represented)
                        // For Gemini next turn, we need to send this too.
                        aiResponseMsg = {
                            role: 'assistant',
                            content: "", // Gemini function call messages often have empty text
                            // We don't have a standard field for 'gemini_function_call' in our type yet, 
                            // but we can store it in content as a placeholder or handle it in the mapping above
                            // For now, let's treat it as an assistant message that triggered a tool.
                            // Ideally we should store the function call details.
                            // Let's use the 'tool_calls' field we added for OpenAI compatibility, adapting it.
                            tool_calls: [{
                                type: 'function',
                                function: { name: fc.name, arguments: JSON.stringify(fc.args) },
                                id: 'gemini_call'
                            }]
                        }
                    } else {
                        const text = parts.map((p: any) => p.text).join('')
                        aiResponseMsg = { role: 'assistant', content: text }
                    }

                } else {
                    // --- OPENAI API ---
                    const openAiTools = tools.length > 0 ? tools.map(t => ({
                        type: 'function',
                        function: {
                            name: t.name,
                            description: t.description,
                            parameters: t.parameters
                        }
                    })) : undefined

                    const res = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: model || 'gpt-3.5-turbo',
                            messages: [
                                { role: "system", content: systemPrompt },
                                ...currentHistory.map(m => {
                                    if (m.role === 'tool') {
                                        return { tool_call_id: m.tool_call_id, role: 'tool', name: m.name, content: m.content }
                                    }
                                    if (m.tool_calls) {
                                        return { role: 'assistant', content: m.content, tool_calls: m.tool_calls }
                                    }
                                    return { role: m.role, content: m.content }
                                })
                            ],
                            tools: openAiTools,
                            tool_choice: openAiTools ? "auto" : undefined,
                            max_tokens: 1000
                        })
                    })

                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}))
                        throw new Error(`OpenAI Error: ${errData.error?.message || res.statusText}`)
                    }
                    const data = await res.json()
                    const choice = data.choices[0]
                    const message = choice.message

                    aiResponseMsg = {
                        role: 'assistant',
                        content: message.content, // Can be null if tool call
                        tool_calls: message.tool_calls
                    }

                    if (message.tool_calls) {
                        toolCallsToExecute = message.tool_calls.map((tc: any) => ({
                            id: tc.id,
                            name: tc.function.name,
                            args: JSON.parse(tc.function.arguments)
                        }))
                    }
                }

                // --- Handle Response State ---
                if (aiResponseMsg) {
                    addMessage(aiResponseMsg!)

                    if (toolCallsToExecute.length === 0) {
                        break; // Exit loop
                    }
                }

                // --- Execute Tools ---
                for (const call of toolCallsToExecute) {
                    const tool = tools.find(t => t.name === call.name)
                    let resultString = ""
                    if (tool) {
                        try {
                            console.log(`Executing tool ${call.name} with args`, call.args)
                            const result = await tool.execute(call.args)
                            resultString = JSON.stringify(result)
                        } catch (e: any) {
                            resultString = `Error: ${e.message}`
                        }
                    } else {
                        resultString = "Error: Tool not found"
                    }

                    // Add Tool Result to History
                    if (provider === 'gemini') {
                        // Gemini tool part
                        // For Gemini, we constructed the functionResponse in the request builder above
                    }

                    const toolMsg: ChatMessage = {
                        role: 'tool',
                        tool_call_id: call.id,
                        name: call.name,
                        content: resultString
                    }
                    addMessage(toolMsg)
                }

                // Loop continues...
            }

        } catch (err: any) {
            console.error("AI Chat Error:", err);
            let errorMessage = err.message || "Неизвестная ошибка";
            if (errorMessage.includes("Failed to fetch")) errorMessage = "Ошибка сети (VPN?).";
            setError(errorMessage)
            addMessage({ role: 'assistant', content: `⚠️ ${errorMessage}` })
        } finally {
            setIsLoading(false)
        }
    }

    const clearHistory = () => clearMessages()

    return { messages, isLoading, error, sendMessage, clearHistory }
}
