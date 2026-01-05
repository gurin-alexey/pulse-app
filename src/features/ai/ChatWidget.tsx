import { useChat } from '@ai-sdk/react'
import { useState, useRef, useEffect } from 'react'
import { Bot, Send, X, Loader2, Sparkles, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // @ts-ignore
    const { messages, input, handleInputChange, handleSubmit, isLoading, reload, stop } = useChat({
        // @ts-ignore
        maxSteps: 5,
        api: '/api/chat', // Note: This requires Vercel deployment or a local proxy to a server running the route
        onError: (err: any) => {
            console.error("Chat error:", err)
        }
    })

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-20 right-6 w-[1200px] max-w-[90vw] h-[700px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                                <Sparkles size={20} className="text-yellow-200" />
                                <h3 className="font-bold">Pulse AI Assistant</h3>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                            {messages.length === 0 && (
                                <div className="text-center text-gray-400 mt-10 text-sm">
                                    <p>Привет! Я могу помочь с задачами.</p>
                                    <p className="mt-2 text-xs">"Создай задачу купить молоко"</p>
                                    <p className="mt-1 text-xs">"Какие планы на сегодня?"</p>
                                </div>
                            )}

                            {messages.map((m: any) => (
                                <div key={m.id} className={clsx("flex flex-col gap-1 max-w-[85%]", m.role === 'user' ? "self-end items-end" : "self-start items-start")}>
                                    <div className={clsx(
                                        "p-3 text-sm rounded-2xl",
                                        m.role === 'user'
                                            ? "bg-blue-600 text-white rounded-br-none"
                                            : "bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm"
                                    )}>
                                        {m.content}
                                    </div>

                                    {/* Tool Invocations */}
                                    <div className="space-y-1">
                                        {m.toolInvocations?.map((toolInvocation: any) => {
                                            const { toolName, toolCallId, state } = toolInvocation

                                            if (state === 'result') {
                                                return (
                                                    <div key={toolCallId} className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                                                        <CheckCircle2 size={12} />
                                                        <span className="font-medium">
                                                            {toolName === 'createTask' ? 'Задача создана' : 'Готово'}
                                                        </span>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div key={toolCallId} className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md animate-pulse">
                                                    <Loader2 size={12} className="animate-spin" />
                                                    <span>Выполняю {toolName}...</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                            {isLoading && messages[messages.length - 1]?.role === 'user' && (
                                <div className="flex items-center gap-2 text-gray-400 text-sm ml-2">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Думаю...</span>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 bg-white flex gap-2">
                            <input
                                value={input}
                                onChange={handleInputChange}
                                placeholder="Напиши что-нибудь..."
                                className="flex-1 bg-gray-100 text-sm px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 transition-all text-gray-800"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send size={18} />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "fixed bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-colors hover:bg-blue-700",
                    isOpen && "bg-gray-700 hover:bg-gray-800"
                )}
            >
                {isOpen ? <X size={24} /> : <Bot size={24} />}
            </motion.button>
        </>
    )
}
