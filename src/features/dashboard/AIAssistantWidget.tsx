import { useState, useRef, useEffect } from "react"
import { useAIChat } from "@/hooks/useAIChat"
import { Send, Settings, Sparkles, Bot, User, Key } from "lucide-react"
import clsx from "clsx"

export function AIAssistantWidget() {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || "")
    const [showSettings, setShowSettings] = useState(false)
    const [input, setInput] = useState("")

    const { messages, isLoading, sendMessage } = useAIChat(apiKey || null)

    // Auto-scroll
    const scrollRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!input.trim() || isLoading) return
        sendMessage(input)
        setInput("")
    }

    const saveApiKey = (key: string) => {
        setApiKey(key)
        localStorage.setItem('openai_api_key', key)
        setShowSettings(false)
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white z-10">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Sparkles size={16} />
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm">AI Assistant</h3>
                </div>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <Settings size={16} />
                </button>
            </div>

            {/* Settings Mode */}
            {showSettings ? (
                <div className="flex-1 p-6 flex flex-col justify-center items-center bg-gray-50/50">
                    <div className="w-full max-w-xs space-y-4">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-3 text-indigo-500">
                                <Key size={24} />
                            </div>
                            <h4 className="font-bold text-gray-800">API Configuration</h4>
                            <p className="text-xs text-gray-500 mt-1">Enter your OpenAI API Key to enable real intelligence. Otherwise, I'll restrict myself to mock responses.</p>
                        </div>
                        <input
                            type="password"
                            placeholder="sk-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500 transition-all font-mono"
                        />
                        <button
                            onClick={() => saveApiKey(apiKey)}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                            Save Key
                        </button>
                        <button
                            onClick={() => setShowSettings(false)}
                            className="w-full py-2 text-gray-400 text-xs hover:text-gray-600"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30 scroll-smooth" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center px-6 opacity-60">
                                <Bot size={32} className="text-gray-300 mb-2" />
                                <p className="text-sm text-gray-400">Hi! I'm your productivity sidekick. How can I help you focus today?</p>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} className={clsx("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                                <div className={clsx(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                    msg.role === 'user' ? "bg-blue-100 text-blue-600" : "bg-indigo-100 text-indigo-600"
                                )}>
                                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                </div>
                                <div className={clsx(
                                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
                                    msg.role === 'user'
                                        ? "bg-blue-600 text-white rounded-tr-none"
                                        : "bg-white border border-gray-100 text-gray-700 rounded-tl-none shadow-sm"
                                )}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                                    <Bot size={14} className="text-indigo-400 animate-pulse" />
                                </div>
                                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-100 rounded-xl px-4 py-2 text-sm outline-none transition-all"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-200"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </>
            )}
        </div>
    )
}
