import { useState, useEffect } from 'react'

export interface TodayFilter {
    excludedTagIds: string[]
    requiredTagIds: string[]
    excludedProjectIds: string[]
}

const STORAGE_KEY = 'pulse_today_filter'

export function useTodayFilter() {
    const [filter, setFilter] = useState<TodayFilter>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return { excludedTagIds: [], requiredTagIds: [], excludedProjectIds: [] }
            const parsed = JSON.parse(raw)
            return {
                excludedTagIds: parsed.excludedTagIds || [],
                requiredTagIds: parsed.requiredTagIds || [],
                excludedProjectIds: parsed.excludedProjectIds || []
            }
        } catch {
            return { excludedTagIds: [], requiredTagIds: [], excludedProjectIds: [] }
        }
    })

    const updateFilterWithNotify = (newFilter: TodayFilter) => {
        setFilter(newFilter)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newFilter))
        window.dispatchEvent(new CustomEvent('pulse_today_filter_change', { detail: newFilter }))
    }

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                setFilter(JSON.parse(e.newValue))
            }
        }

        const handleCustomEvent = (e: CustomEvent) => {
            setFilter(e.detail)
        }

        window.addEventListener('storage', handleStorageChange)
        window.addEventListener('pulse_today_filter_change', handleCustomEvent as EventListener)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
            window.removeEventListener('pulse_today_filter_change', handleCustomEvent as EventListener)
        }
    }, [])

    const toggleExcludedTag = (tagId: string) => {
        const isExcluded = filter.excludedTagIds.includes(tagId)
        const newFilter = {
            ...filter,
            excludedTagIds: isExcluded
                ? filter.excludedTagIds.filter(id => id !== tagId)
                : [...filter.excludedTagIds, tagId]
        }
        updateFilterWithNotify(newFilter)
    }

    const toggleExcludedProject = (projectId: string) => {
        const isExcluded = filter.excludedProjectIds?.includes(projectId)
        const newFilter = {
            ...filter,
            excludedProjectIds: isExcluded
                ? filter.excludedProjectIds.filter(id => id !== projectId)
                : [...(filter.excludedProjectIds || []), projectId]
        }
        updateFilterWithNotify(newFilter)
    }

    const setExcludedTags = (ids: string[]) => {
        updateFilterWithNotify({ ...filter, excludedTagIds: ids })
    }

    const setExcludedProjects = (ids: string[]) => {
        updateFilterWithNotify({ ...filter, excludedProjectIds: ids })
    }

    const resetFilters = () => {
        updateFilterWithNotify({ excludedTagIds: [], requiredTagIds: [], excludedProjectIds: [] })
    }

    return {
        filter,
        updateFilter: updateFilterWithNotify,
        toggleExcludedTag,
        toggleExcludedProject,
        setExcludedTags,
        setExcludedProjects,
        resetFilters
    }
}
