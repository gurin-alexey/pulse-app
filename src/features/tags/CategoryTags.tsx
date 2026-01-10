import { useState, useRef, useEffect } from 'react'
import { Plus, Check } from 'lucide-react'
import { useTags, useTaskTags, useCreateTag, useToggleTaskTag } from '@/hooks/useTags'
import clsx from 'clsx'
import { CATEGORIES, type CategoryType } from '@/constants/categories'

type CategoryTagsProps = {
    taskId: string
    readOnly?: boolean
}

export function CategoryTags({ taskId, readOnly }: CategoryTagsProps) {
    const { data: allTags } = useTags()
    const { data: taskTags } = useTaskTags(taskId)
    const { mutate: createTag, isPending: isCreating } = useCreateTag()
    const { mutate: toggleTag } = useToggleTaskTag()

    const [activeCategory, setActiveCategory] = useState<CategoryType | null>(null)
    const [filter, setFilter] = useState('')
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveCategory(null)
                setFilter('')
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleCreateTag = () => {
        if (!filter.trim() || !activeCategory) return
        createTag({ name: filter, category: activeCategory }, {
            onSuccess: (newTag) => {
                toggleTag({ taskId, tagId: newTag.id, isAttached: false })
                setFilter('')
            }
        })
    }

    return (
        <div className="flex items-center gap-1" ref={dropdownRef}>
            {CATEGORIES.map(cat => {
                const CategoryIcon = cat.icon
                // Find all attached tags for this category
                const activeTags = taskTags?.filter(t => t.category === cat.id) || []
                const hasTags = activeTags.length > 0

                return (
                    <div key={cat.id} className="relative">
                        <button
                            onClick={() => {
                                if (activeCategory === cat.id) {
                                    setActiveCategory(null)
                                } else {
                                    setActiveCategory(cat.id)
                                    setFilter('')
                                }
                            }}
                            className={clsx(
                                "flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all",
                                hasTags ? "bg-gray-100" : "hover:bg-gray-50 text-gray-400 hover:text-gray-600",
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

                        {/* Dropdown */}
                        {activeCategory === cat.id && (
                            <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-gray-200 shadow-xl rounded-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                <div className="p-2 border-b border-gray-50">
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder={`Добавить ${cat.label.toLowerCase()}...`}
                                        value={filter}
                                        onChange={e => setFilter(e.target.value)}
                                        className="w-full text-xs px-2 py-1.5 bg-gray-50 rounded border-none outline-none focus:ring-1 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                                    />
                                </div>

                                <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                                    {/* Existing tags for this category */}
                                    {allTags?.filter(t => t.category === cat.id && t.name.toLowerCase().includes(filter.toLowerCase())).map(tag => {
                                        const isAttached = taskTags?.some(t => t.id === tag.id) || false
                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => toggleTag({ taskId, tagId: tag.id, isAttached })}
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
                                    {filter && !allTags?.some(t => t.category === cat.id && t.name.toLowerCase() === filter.toLowerCase()) && (
                                        <button
                                            onClick={handleCreateTag}
                                            disabled={isCreating}
                                            className="w-full text-left px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg flex items-center mt-1"
                                        >
                                            <Plus size={12} className="mr-1" />
                                            Создать "{filter}"
                                        </button>
                                    )}

                                    {/* Empty State */}
                                    {!filter && allTags?.filter(t => t.category === cat.id).length === 0 && (
                                        <div className="px-2 py-3 text-center text-xs text-gray-400 italic">
                                            Нет тегов.<br />Начните вводить, чтобы создать.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
