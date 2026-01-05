import { create } from 'zustand'

type SelectionState = {
    selectedIds: Set<string>
    lastSelectedId: string | null
    select: (id: string | null) => void
    toggle: (id: string) => void
    selectRange: (ids: string[]) => void
    clear: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
    selectedIds: new Set(),
    lastSelectedId: null,
    select: (id) => set({
        selectedIds: id ? new Set([id]) : new Set(),
        lastSelectedId: id
    }),
    toggle: (id) => set((state) => {
        const newSet = new Set(state.selectedIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        return { selectedIds: newSet, lastSelectedId: id }
    }),
    selectRange: (ids) => set((state) => {
        const newSet = new Set(state.selectedIds)
        ids.forEach(id => newSet.add(id))
        return { selectedIds: newSet }
    }),
    clear: () => set({ selectedIds: new Set(), lastSelectedId: null })
}))
