import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Define the message type here to avoid circular dependencies
// Ideally this should be shared, but for now we duplicate or import from a types file if exists.
// Since ChatMessage is currently defined in useAIChat.ts, let's move it to a shared type file or redefine it compatible.
// For simplicity and robustness, I will define a compatible interface here.

export type ChatMessage = {
    role: 'user' | 'assistant' | 'system' | 'function' | 'tool'
    content?: string
    tool_call_id?: string
    name?: string
    tool_calls?: any[]
    function_call?: any
}

interface ChatState {
    messages: ChatMessage[]
    addMessage: (message: ChatMessage) => void
    setMessages: (messages: ChatMessage[]) => void
    clearMessages: () => void
}

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            messages: [],
            addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
            setMessages: (messages) => set({ messages }),
            clearMessages: () => set({ messages: [] }),
        }),
        {
            name: 'chat-history-storage', // name of the item in the storage (must be unique)
            storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
        }
    )
)
