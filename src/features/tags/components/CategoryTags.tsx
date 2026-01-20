import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Check, Hash } from 'lucide-react'
import { useTags } from '@/features/tags/hooks/useTags'
import { useTagMutations } from '@/features/tags/hooks/useTagMutations'
import clsx from 'clsx'
import { CATEGORIES, type CategoryType } from '@/features/tags/constants'
import type { Tag } from '@/types/database'

type CategoryTagsProps = {
    taskId: string
    tags?: Tag[]
    readOnly?: boolean
    direction?: 'up' | 'down'
}

type DropdownState = {
    category: CategoryType | 'other'
    position: {
        x: number
        y: number
        align: 'top' | 'bottom'
    }
}

export function CategoryTags({ taskId, tags: initialTags, readOnly, direction = 'down' }: CategoryTagsProps) {
    const { data: allTags } = useTags()
    const taskTags = initialTags || []
    const { createTag, toggleTaskTag } = useTagMutations()

    const [dropdownState, setDropdownState] = useState<DropdownState | null>(null)
    const [filter, setFilter] = useState('')

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Since portal is in body, any click on document that isn't stopped should close it.
            // We rely on the dropdown container stopping propagation to prevent this from firing when clicking inside.
            // However, clicking the toggle button itself also needs to not re-open immediately if logic is separate.
            // But here we set null.
            // If we click the button, it triggers toggleDropdown, which stops propagation.
            // So this listener only catches clicks outside dropdown AND outside buttons.
            setDropdownState(null)
            setFilter('')
        }

        if (dropdownState) {
            // Use capture to catch events before they are stopped by other elements? 
            // Or just bubble. Bubble is fine if we stop propagation on the dropdown itself.
            document.addEventListener("click", handleClickOutside)
            // Handle window resize/scroll to close or reposition? Close is safer for simple implementation.
            window.addEventListener("resize", () => setDropdownState(null))
            // window.addEventListener("scroll", () => setDropdownState(null), true) 
            return () => {
                document.removeEventListener("click", handleClickOutside)
                window.removeEventListener("resize", () => setDropdownState(null))
            }
        }
    }, [dropdownState])

    const toggleDropdown = (catId: CategoryType | 'other', e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (dropdownState?.category === catId) {
            setDropdownState(null)
            setFilter('')
            return
        }

        const rect = e.currentTarget.getBoundingClientRect()
        const isUp = direction === 'up'

        // Calculate X
        let x = rect.left
        // Dropdown width is w-56 (14rem = 224px). Add margin.
        if (x + 230 > window.innerWidth) {
            x = rect.right - 224
        }
        // Ensure not negative
        if (x < 10) x = 10

        // Calculate Y
        // If down: top = rect.bottom. If up: bottom = window.innerHeight - rect.top.
        // We calculate absolute Y for "top" or "bottom" CSS property.

        const y = isUp
            ? (window.innerHeight - rect.top + 4) // Logic for bottom: Y px from bottom
            : (rect.bottom + 4) // Logic for top: Y px from top

        setDropdownState({
            category: catId,
            position: {
                x,
                y,
                align: isUp ? 'bottom' : 'top'
            }
        })
        setFilter('')
    }

    // Helper to render content inside portal
    const renderDropdownContent = () => {
        if (!dropdownState) return null

        const catId = dropdownState.category
        const isOther = catId === 'other'
        const categoryLabel = isOther ? 'тег' : CATEGORIES.find(c => c.id === catId)?.label.toLowerCase() || '...'

        // Filter tags
        const availableTags = allTags?.filter(t => {
            const matchesCategory = isOther
                ? (!t.category || !CATEGORIES.some(c => c.id === t.category))
                : t.category === catId
            const matchesFilter = t.name.toLowerCase().includes(filter.toLowerCase())
            return matchesCategory && matchesFilter
        }) || []

        const showCreate = filter && !availableTags.some(t => t.name.toLowerCase() === filter.toLowerCase())
        const isEmpty = !filter && availableTags.length === 0

        const style: React.CSSProperties = {
            position: 'fixed',
            left: dropdownState.position.x,
            zIndex: 9999,
        }

        if (dropdownState.position.align === 'top') {
            style.top = dropdownState.position.y
        } else {
            style.bottom = dropdownState.position.y
        }

        return createPortal(
            <div
                style={style}
                className="w-56 bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-64"
                onClick={e => e.stopPropagation()} // Prevent document listener from closing
            >
                <div className="p-2 border-b border-gray-50 bg-white sticky top-0 z-10">
                    <input
                        type="text"
                        autoFocus
                        placeholder={`Добавить ${categoryLabel}...`}
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="w-full text-xs px-2 py-1.5 bg-gray-50 rounded border-none outline-none focus:ring-1 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                        onKeyDown={e => {
                            if (e.key === 'Escape') {
                                setDropdownState(null)
                            }
                        }}
                    />
                </div>

                <div className="overflow-y-auto p-1 space-y-0.5 flex-1">
                    {availableTags.map(tag => {
                        const isAttached = taskTags.some(t => t.id === tag.id)
                        return (
                            <button
                                key={tag.id}
                                onClick={() => toggleTaskTag.mutate({ taskId, tagId: tag.id, isAttached })}
                                className="w-full text-left px-2 py-1.5 text-xs rounded-lg hover:bg-gray-50 flex items-center justify-between group transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                    <span className="text-gray-700">{tag.name}</span>
                                </div>
                                {isAttached && <Check size={12} className="text-blue-600" />}
                            </button>
                        )
                    })}

                    {/* Create New Option */}
                    {showCreate && (
                        <button
                            onClick={() => {
                                if (!filter.trim()) return
                                createTag.mutate({
                                    name: filter,
                                    category: isOther ? undefined : (catId as CategoryType)
                                }, {
                                    onSuccess: (newTag) => {
                                        toggleTaskTag.mutate({ taskId, tagId: newTag.id, isAttached: false })
                                        setFilter('')
                                    }
                                })
                            }}
                            disabled={createTag.isPending}
                            className="w-full text-left px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg flex items-center mt-1"
                        >
                            <Plus size={12} className="mr-1" />
                            Создать "{filter}"
                        </button>
                    )}

                    {/* Empty State */}
                    {isEmpty && (
                        <div className="px-2 py-3 text-center text-xs text-gray-400 italic">
                            Нет тегов
                        </div>
                    )}
                </div>
            </div>,
            document.body
        )
    }

    return (
        <div className="flex items-center gap-1">
            {CATEGORIES.map(cat => {
                const CategoryIcon = cat.icon
                const activeTags = taskTags.filter(t => t.category === cat.id)
                const hasTags = activeTags.length > 0
                const isActive = dropdownState?.category === cat.id

                return (
                    <button
                        key={cat.id}
                        onClick={(e) => toggleDropdown(cat.id, e)}
                        className={clsx(
                            "flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all",
                            (hasTags || isActive) ? "bg-gray-100" : "hover:bg-gray-50 text-gray-400 hover:text-gray-600",
                        )}
                        title={cat.label}
                    >
                        <CategoryIcon size={16} className={clsx(hasTags ? cat.color : "text-gray-400")} />
                        {hasTags && (
                            <span className={clsx("text-xs font-medium max-w-[60px] truncate", cat.color)}>
                                {activeTags.map(t => t.name).join(', ')}
                            </span>
                        )}
                    </button>
                )
            })}

            {/* OTHER / UNCATEGORIZED TAGS */}
            {(() => {
                const otherTags = taskTags.filter(t => !t.category || !CATEGORIES.some(c => c.id === t.category))
                const hasOtherTags = otherTags.length > 0
                const isActive = dropdownState?.category === 'other'

                return (
                    <button
                        onClick={(e) => toggleDropdown('other', e)}
                        className={clsx(
                            "flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all",
                            (hasOtherTags || isActive) ? "bg-gray-100" : "hover:bg-gray-50 text-gray-400 hover:text-gray-600",
                        )}
                        title="Другие"
                    >
                        <Hash size={16} className={clsx(hasOtherTags ? "text-gray-600" : "text-gray-400")} />
                        {hasOtherTags && (
                            <span className={clsx("text-xs font-medium max-w-[60px] truncate text-gray-600")}>
                                {otherTags.map(t => t.name).join(', ')}
                            </span>
                        )}
                    </button>
                )
            })()}

            {renderDropdownContent()}
        </div>
    )
}
