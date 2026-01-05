import { useState, useRef, useEffect } from 'react'
import { Plus, X, Tag as TagIcon, Check } from 'lucide-react'
import { useTags, useTaskTags, useCreateTag, useToggleTaskTag } from '@/hooks/useTags'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

type TagManagerProps = {
    taskId: string
    readOnly?: boolean
}

export function TagManager({ taskId, readOnly }: TagManagerProps) {
    const { data: allTags } = useTags()
    const { data: taskTags, isLoading } = useTaskTags(taskId)
    const { mutate: createTag, isPending: isCreating } = useCreateTag()
    const { mutate: toggleTag } = useToggleTaskTag()

    const [isOpen, setIsOpen] = useState(false)
    const [showInput, setShowInput] = useState(false)
    const [filter, setFilter] = useState('')
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close on click outside and reset
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
                setShowInput(false)
                setFilter('')
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const attachedTagIds = new Set(taskTags?.map(t => t.id) || [])

    // Filter tags if input is shown, otherwise show all
    const visibleTags = showInput
        ? (allTags?.filter(t => t.name.toLowerCase().includes(filter.toLowerCase())) || [])
        : (allTags || [])

    const exactMatch = visibleTags.some(t => t.name.toLowerCase() === filter.toLowerCase())

    const handleCreateTag = () => {
        if (!filter.trim()) return
        createTag(filter, {
            onSuccess: (newTag) => {
                toggleTag({ taskId, tagId: newTag.id, isAttached: false })
                setFilter('')
            }
        })
    }

    if (isLoading) return null

    return (
        <div className="flex flex-wrap items-center gap-2">
            {taskTags?.map(tag => (
                <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-opacity-10 text-gray-700"
                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                    {tag.name}
                    {!readOnly && (
                        <button
                            onClick={() => toggleTag({ taskId, tagId: tag.id, isAttached: true })}
                            className="ml-1 hover:text-red-500 focus:outline-none"
                        >
                            <X size={12} />
                        </button>
                    )}
                </span>
            ))}

            {!readOnly && (
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => {
                            if (!isOpen) {
                                setIsOpen(true)
                                setShowInput(false)
                                setFilter('')
                            } else {
                                setIsOpen(false)
                            }
                        }}
                        className="flex items-center text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-0.5 rounded transition-colors"
                    >
                        <Plus size={14} className="mr-1" />
                        Add Tag
                    </button>

                    {isOpen && (
                        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 shadow-lg rounded-md z-50 p-2">
                            {showInput && (
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Tag name..."
                                    value={filter}
                                    onChange={e => setFilter(e.target.value)}
                                    className="w-full text-xs px-2 py-1.5 border-b border-gray-100 outline-none mb-2 text-gray-700 placeholder:text-gray-400 rounded bg-gray-50 focus:bg-white transition-colors"
                                />
                            )}

                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                                {visibleTags.map(tag => {
                                    const isAttached = attachedTagIds.has(tag.id)
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => toggleTag({ taskId, tagId: tag.id, isAttached })}
                                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                                <span className="text-gray-700">{tag.name}</span>
                                            </div>
                                            {isAttached && <Check size={12} className="text-blue-500" />}
                                        </button>
                                    )
                                })}

                                {showInput && filter && !exactMatch && (
                                    <button
                                        onClick={handleCreateTag}
                                        disabled={isCreating}
                                        className="w-full text-left px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded flex items-center"
                                    >
                                        <Plus size={12} className="mr-1" />
                                        Create "{filter}"
                                    </button>
                                )}

                                {!showInput && (
                                    <button
                                        onClick={() => setShowInput(true)}
                                        className="w-full text-left px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded flex items-center mt-1 border-t border-gray-50 pt-2"
                                    >
                                        <Plus size={12} className="mr-1" />
                                        New Tag
                                    </button>
                                )}

                                {visibleTags.length === 0 && !filter && showInput && (
                                    <div className="text-center py-2 text-xs text-gray-400">
                                        Type to create
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
