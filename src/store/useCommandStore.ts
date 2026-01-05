import { create } from 'zustand'

type CommandState = {
    isOpen: boolean
    setOpen: (open: boolean) => void
    toggle: () => void
}

export const useCommandStore = create<CommandState>((set) => ({
    isOpen: false,
    setOpen: (open) => set({ isOpen: open }),
    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}))
