import { useState, useRef, useEffect, useMemo } from "react"
import { useAIChat, type AIProvider } from "@/hooks/useAIChat"
import { Send, Settings, Sparkles, Bot, User, Key, Database, Zap, Maximize2, Minimize2 } from "lucide-react"
import clsx from "clsx"
import { useTasks } from "@/hooks/useTasks"
import { useProjects } from "@/hooks/useProjects"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function AIAssistantWidget() {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('ai_api_key') || "")
    const [provider, setProvider] = useState<AIProvider>(() => (localStorage.getItem('ai_provider') as AIProvider) || 'openai')
    const [modelName, setModelName] = useState(() => localStorage.getItem('ai_model_name') || "")
    const [isExpanded, setIsExpanded] = useState(false)

    // Set default model if empty when provider changes
    useEffect(() => {
        if (!modelName) {
            if (provider === 'openai') setModelName('gpt-3.5-turbo')
            if (provider === 'gemini') setModelName('gemini-2.0-flash')
        }
    }, [provider, modelName])

    // Auto-detect provider based on key format
    useEffect(() => {
        if (!apiKey) return
        if (apiKey.startsWith('AIza')) {
            setProvider('gemini')
            if (!modelName) setModelName('gemini-2.0-flash')
        } else if (apiKey.startsWith('sk-')) {
            setProvider('openai')
            if (!modelName) setModelName('gpt-3.5-turbo')
        }
    }, [apiKey])

    const [showSettings, setShowSettings] = useState(false)
    const [input, setInput] = useState("")

    // 1. Fetch Data for Context
    const { data: tasks } = useTasks({ type: 'all' })
    const { data: projects } = useProjects()

    // 2. Prepare Context String
    const systemContext = useMemo(() => {
        if (!tasks && !projects) return ""

        let context = ""

        if (projects && projects.length > 0) {
            context += `ПРОЕКТЫ(${projects.length}): \n`
            context += projects.map(p => `- ${p.name} (ID: ${p.id})`).join('\n')
            context += `\n\n`
        }

        if (tasks && tasks.length > 0) {
            const pendingTasks = tasks.filter(t => !t.is_completed)
            context += `АКТИВНЫЕ ЗАДАЧИ(${pendingTasks.length}): \n`
            context += pendingTasks.slice(0, 50).map(t => {
                const status = t.is_completed ? "[x]" : "[ ]"
                const date = t.due_date ? `(до ${t.due_date})` : ""
                return `${status} ${t.title} ${date} `
            }).join('\n')
        } else {
            context += "ЗАДАЧ НЕТ."
        }

        return context
    }, [tasks, projects])

    // 3. Initialize AI with Context
    const { messages, isLoading, sendMessage } = useAIChat(apiKey || null, provider, modelName, systemContext)

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

    const saveSettings = () => {
        localStorage.setItem('ai_api_key', apiKey)
        localStorage.setItem('ai_provider', provider)
        localStorage.setItem('ai_model_name', modelName)
        setShowSettings(false)
    }

    return (
        <div className={clsx(
            "flex flex-col bg-white shadow-sm border border-gray-100 overflow-hidden transition-all duration-300",
            isExpanded
                ? "fixed top-0 bottom-0 left-0 right-0 md:left-64 xl:right-[350px] z-40 h-screen rounded-none border-x-4 border-indigo-50/50"
                : "h-full rounded-2xl relative"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={clsx("p-2 text-white rounded-xl shadow-md transition-colors",
                        provider === 'gemini' ? "bg-gradient-to-br from-blue-500 to-cyan-500 shadow-blue-200" : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-200"
                    )}>
                        {provider === 'gemini' ? <Zap size={18} /> : <Sparkles size={18} />}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 text-base">
                            {provider === 'gemini' ? "Gemini Assistant" : "AI Planner"}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                            {apiKey ? (
                                <span className="flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                                    <Database size={10} />
                                    <span>Connected ({modelName})</span>
                                </span>
                            ) : (
                                <span>Mock Mode (No Key)</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title={isExpanded ? "Minimize" : "Expand"}
                    >
                        {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            {/* Settings Mode */}
            {showSettings ? (
                <div className="flex-1 p-8 flex flex-col justify-center items-center bg-gray-50/50 overflow-y-auto">
                    <div className="w-full max-w-sm space-y-5">
                        <div className="text-center">
                            <h4 className="font-bold text-gray-800 text-lg">AI Configuration</h4>
                            <p className="text-sm text-gray-500 mt-1">Choose your provider and enter the key.</p>
                        </div>

                        <div className="flex bg-gray-200 p-1 rounded-xl">
                            <button
                                onClick={() => { setProvider('openai'); setModelName('gpt-3.5-turbo'); }}
                                className={clsx("flex-1 py-2 text-sm font-medium rounded-lg transition-all", provider === 'openai' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700")}
                            >
                                OpenAI
                            </button>
                            <button
                                onClick={() => { setProvider('gemini'); setModelName('gemini-2.0-flash'); }}
                                className={clsx("flex-1 py-2 text-sm font-medium rounded-lg transition-all", provider === 'gemini' ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700")}
                            >
                                Google Gemini
                            </button>
                        </div>

                        <div className="space-y-3">
                            {/* API Key Input */}
                            <div className="relative">
                                <Key size={16} className="absolute left-3 top-3.5 text-gray-400" />
                                <input
                                    type="password"
                                    placeholder={provider === 'openai' ? "sk-..." : "AIza..."}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-mono shadow-sm"
                                />
                            </div>

                            {/* Model Name Input */}
                            <div className="relative">
                                <div className="absolute left-3 top-3.5 text-gray-400 font-mono text-xs font-bold">MODEL</div>
                                <input
                                    type="text"
                                    placeholder="e.g. gpt-4o or gemini-2.0-flash"
                                    value={modelName}
                                    onChange={(e) => setModelName(e.target.value)}
                                    className="w-full pl-16 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-mono shadow-sm"
                                />
                            </div>

                            <button
                                onClick={saveSettings}
                                className={clsx("w-full py-2.5 text-white rounded-xl text-sm font-semibold transition-all shadow-md active:scale-[0.98]",
                                    provider === 'gemini' ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                                )}
                            >
                                Save Configuration
                            </button>
                        </div>
                        <button
                            onClick={() => setShowSettings(false)}
                            className="w-full py-2 text-gray-400 text-xs hover:text-gray-600 font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/30 scroll-smooth" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center px-8 opacity-60">
                                <div className={clsx("w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm",
                                    provider === 'gemini' ? "text-blue-400" : "text-indigo-300"
                                )}>
                                    {provider === 'gemini' ? <Zap size={32} /> : <Bot size={32} />}
                                </div>
                                <h4 className="font-medium text-gray-600 mb-1">
                                    {provider === 'gemini' ? "Gemini is Ready" : "ChatGPT is Ready"}
                                </h4>
                                <p className="text-sm text-gray-400 max-w-md">
                                    {modelName} is active. I have access to your tasks and projects.
                                </p>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} className={clsx("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                                <div className={clsx(
                                    "w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                                    msg.role === 'user'
                                        ? (provider === 'gemini' ? "bg-blue-600 text-white" : "bg-indigo-600 text-white")
                                        : "bg-white border border-gray-100 text-gray-600"
                                )}>
                                    {msg.role === 'user' ? <User size={16} /> : (provider === 'gemini' ? <Zap size={16} /> : <Bot size={16} />)}
                                </div>
                                <div className={clsx(
                                    "max-w-[85%] rounded-2xl px-5 py-3 text-[15px] leading-relaxed shadow-sm overflow-hidden",
                                    msg.role === 'user'
                                        ? (provider === 'gemini' ? "bg-blue-600 text-white rounded-tr-none" : "bg-indigo-600 text-white rounded-tr-none")
                                        : "bg-white border border-gray-100 text-gray-700 rounded-tl-none"
                                )}>
                                    <div className={clsx("markdown-content space-y-3", msg.role === 'user' ? "[&_a]:text-white/90 [&_code]:bg-white/20 [&_pre]:bg-black/20" : "[&_a]:text-blue-600 [&_code]:bg-gray-100 [&_pre]:bg-gray-50")}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                p: ({ children }: any) => <p className="mb-0 last:mb-0 leading-relaxed">{children}</p>,
                                                ul: ({ children }: any) => <ul className="list-disc list-outside ml-4 space-y-1">{children}</ul>,
                                                ol: ({ children }: any) => <ol className="list-decimal list-outside ml-4 space-y-1">{children}</ol>,
                                                li: ({ children }: any) => <li className="">{children}</li>,
                                                a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80 font-medium">{children}</a>,
                                                code: ({ children }: any) => <code className="px-1.5 py-0.5 rounded text-[13px] font-mono font-medium">{children}</code>,
                                                pre: ({ children }: any) => <pre className="p-3 rounded-xl overflow-x-auto text-xs font-mono my-2 border border-black/5">{children}</pre>,
                                                h1: ({ children }: any) => <h1 className="text-lg font-bold mt-2 mb-1">{children}</h1>,
                                                h2: ({ children }: any) => <h2 className="text-base font-bold mt-2 mb-1">{children}</h2>,
                                                h3: ({ children }: any) => <h3 className="text-sm font-bold mt-1 mb-1">{children}</h3>,
                                                blockquote: ({ children }: any) => <blockquote className="border-l-4 border-current pl-3 italic opacity-80 my-2">{children}</blockquote>
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-4">
                                <div className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-sm">
                                    {provider === 'gemini' ? <Zap size={16} className="text-blue-400" /> : <Bot size={16} className="text-indigo-400" />}
                                </div>
                                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm flex gap-1.5 items-center">
                                    <span className="text-xs font-medium text-gray-400 mr-2">Thinking</span>
                                    <div className={clsx("w-1.5 h-1.5 rounded-full animate-bounce", provider === 'gemini' ? "bg-blue-400" : "bg-indigo-400")} style={{ animationDelay: '0ms' }} />
                                    <div className={clsx("w-1.5 h-1.5 rounded-full animate-bounce", provider === 'gemini' ? "bg-blue-400" : "bg-indigo-400")} style={{ animationDelay: '150ms' }} />
                                    <div className={clsx("w-1.5 h-1.5 rounded-full animate-bounce", provider === 'gemini' ? "bg-blue-400" : "bg-indigo-400")} style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-100 flex gap-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={apiKey ? "Ask about your projects or tasks..." : "Enter API key in settings..."}
                            className="flex-1 bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl px-5 py-3 text-sm outline-none transition-all"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className={clsx("px-5 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 flex items-center justify-center",
                                provider === 'gemini' ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                            )}
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </>
            )}
        </div>
    )
}
