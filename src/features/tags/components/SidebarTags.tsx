import { useState, useMemo, useRef, useEffect } from 'react'
import { useTags } from '../hooks/useTags'
import { useTagMutations } from '../hooks/useTagMutations'
import { CATEGORIES } from '../constants'
import { ChevronDown, ChevronRight, Hash, MoreHorizontal, Plus, Trash2, Edit2, CornerDownRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import type { Tag } from '@/types/database'


type TreeNode = Tag & {
    children: TreeNode[]
}

function buildTree(tags: Tag[]): TreeNode[] {
    const map = new Map<string, TreeNode>()
    const roots: TreeNode[] = []

    // Initialize map
    tags.forEach(tag => {
        map.set(tag.id, { ...tag, children: [] })
    })

    // Connect nodes
    tags.forEach(tag => {
        const node = map.get(tag.id)!
        if (tag.parent_id && map.has(tag.parent_id)) {
            map.get(tag.parent_id)!.children.push(node)
        } else {
            roots.push(node)
        }
    })

    return roots
}

// ... existing imports

// ... imports

import { createPortal } from 'react-dom'

// ...

const TagActionsMenu = ({ onEdit, onDelete, onAddSubtag }: { onEdit: () => void, onDelete: (e: React.MouseEvent) => void, onAddSubtag: (e: React.MouseEvent) => void }) => {
    const [isOpen, setIsOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [coords, setCoords] = useState({ top: 0, left: 0 })

    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setCoords({
                top: rect.bottom + window.scrollY + 4,
                left: rect.right - 128 // 128px is roughly w-32
            })
        }
    }, [isOpen])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                // Check if click is inside the portal menu (we can't easily ref the portal content directly here without another ref, but since we stopPropagation on menu click, checking button is usually sufficient IF the menu handles its own stopPropagation)
                // Actually, for portal, we need to be careful.
                // Simpler: Just rely on the fact that the menu itself prevents propagation?
                // Or better: Use a ref for the dropdown too.
                const dropdown = document.getElementById('tag-actions-dropdown')
                if (dropdown && !dropdown.contains(e.target as Node)) {
                    setIsOpen(false)
                }
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            window.addEventListener('resize', () => setIsOpen(false)) // Close on resize to update coords
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            window.removeEventListener('resize', () => setIsOpen(false))
        }
    }, [isOpen])

    return (
        <>
            <button
                ref={buttonRef}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen) }}
                className={clsx(
                    "p-0.5 rounded transition-all text-gray-300 hover:text-gray-600 hover:bg-gray-200",
                    isOpen && "text-gray-600 bg-gray-200"
                )}
            >
                <MoreHorizontal size={14} />
            </button>

            {isOpen && createPortal(
                <div
                    id="tag-actions-dropdown"
                    className="fixed z-[9999] bg-white border border-gray-200 shadow-xl rounded-md py-1 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 w-32"
                    style={{ top: coords.top, left: coords.left }}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onAddSubtag(e) }}
                        className="text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 w-full transition-colors"
                    >
                        <Plus size={12} className="text-gray-400" />
                        Add Subtag
                    </button>
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onEdit() }}
                        className="text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 w-full transition-colors"
                    >
                        <Edit2 size={12} className="text-gray-400" />
                        Rename
                    </button>
                    <div className="h-px bg-gray-50 my-0.5" />
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onDelete(e) }}
                        className="text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 w-full transition-colors"
                    >
                        <Trash2 size={12} className="text-red-500" />
                        Delete
                    </button>
                </div>,
                document.body
            )}
        </>
    )
}

const TagItem = ({ node, level = 0, indent = false }: { node: TreeNode, level?: number, indent?: boolean }) => {
    const location = useLocation()
    const isActive = location.pathname === `/tags/${node.id}`
    const { deleteTag, updateTag, createTag } = useTagMutations()
    const [isHovered, setIsHovered] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState(node.name)

    const handleDelete = (e: React.MouseEvent) => {
        // e.preventDefault() handled in menu
        // e.stopPropagation() handled in menu
        if (confirm('Delete this tag?')) {
            deleteTag.mutate(node.id)
        }
    }

    const handleUpdate = () => {
        if (editName.trim() !== node.name) {
            updateTag.mutate({ id: node.id, updates: { name: editName } })
        }
        setIsEditing(false)
    }

    const handleAddSubtag = (e: React.MouseEvent) => {
        createTag.mutate({ name: 'New Subtag', parent_id: node.id })
    }

    // Calculate base padding: level * 12 + 8. If indent is true (for category children), add extra 12px.
    const basePadding = level * 12 + 8
    const extraPadding = indent && level === 0 ? 12 : 0
    const paddingLeft = basePadding + extraPadding

    return (
        <div>
            <div
                className={clsx(
                    "group flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors text-sm relative",
                    isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                )}
                style={{ paddingLeft: `${paddingLeft}px` }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Visual Tree Guide line */}
                {level > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-100" style={{ left: `${(level - 1) * 12 + 12}px` }} />
                )}

                {isActive ? (
                    <Hash size={14} className="shrink-0 text-blue-500" />
                ) : (
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: node.color }} />
                )}

                {isEditing ? (
                    <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={handleUpdate}
                        onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                        className="bg-white border border-blue-200 rounded px-1 py-0.5 text-xs w-full outline-none"
                    />
                ) : (
                    <Link to={`/tags/${node.id}`} className="flex-1 truncate block">
                        {node.name}
                    </Link>
                )}

                {/* Actions (Only on hover, grouped) */}
                <div className={clsx("opacity-0 group-hover:opacity-100 transition-opacity", isEditing && "hidden")}>
                    <TagActionsMenu
                        onEdit={() => setIsEditing(true)}
                        onAddSubtag={handleAddSubtag}
                        onDelete={handleDelete}
                    />
                </div>
            </div>

            {/* Render children */}
            {node.children.length > 0 && (
                <div className="flex flex-col">
                    {node.children.map(child => (
                        <TagItem key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}

const CategorySection = ({ category, roots, indent }: { category: any, roots: TreeNode[], indent?: boolean }) => {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const { createTag } = useTagMutations()
    const CatIcon = category.icon

    return (
        <div key={category.id} className="mb-2">
            <div
                className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider opacity-70 group/cat-header hover:opacity-100 transition-opacity cursor-pointer hover:bg-gray-50 rounded"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="flex items-center gap-2">
                    <ChevronDown
                        size={12}
                        className={clsx("transition-transform text-gray-400", isCollapsed && "-rotate-90")}
                    />
                    <CatIcon size={12} />
                    <span>{category.label}</span>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        createTag.mutate({ name: 'Новый тег', category: category.id })
                    }}
                    className="opacity-0 group-hover/cat-header:opacity-100 p-0.5 hover:bg-gray-200 rounded text-gray-600 transition-all"
                    title={`Add to ${category.label}`}
                >
                    <Plus size={12} />
                </button>
            </div>

            <div className={clsx(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
            )}>
                {roots.length > 0 ? (
                    roots.map(node => (
                        <TagItem key={node.id} node={node} indent />
                    ))
                ) : (
                    <div className="px-2 py-1 text-xs text-gray-300 italic pl-8">
                        Нет тегов
                    </div>
                )}
            </div>
        </div>
    )
}

export function SidebarTags() {
    // ... existing hook calls
    const { data: tags } = useTags()
    const { createTag } = useTagMutations()
    const [isExpanded, setIsExpanded] = useState(false)

    // Transform flat list to tree
    const tree = useMemo(() => tags ? buildTree(tags) : [], [tags])

    if (!tags || tags.length === 0) return null

    return (
        <div className="mt-4 px-2">
            {/* Header / Collapse Toggle Area */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors group mb-1"
            >
                <span>Tags</span>
                <ChevronDown
                    size={14}
                    className={clsx(
                        "transition-transform duration-300 opacity-0 group-hover:opacity-100",
                        isExpanded ? "rotate-180" : ""
                    )}
                />
            </button>

            {/* List Container with Smooth Transition */}
            <div className={clsx(
                "overflow-hidden transition-all duration-500 ease-in-out",
                isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="space-y-0.5 pb-4">
                    {/* Categorized Roots */}
                    {CATEGORIES.map(category => {
                        const categoryRoots = tree.filter(node => node.category === category.id)
                        return <CategorySection key={category.id} category={category} roots={categoryRoots} indent />
                    })}

                    {/* Uncategorized Roots */}
                    {(() => {
                        const uncategorizedRoots = tree.filter(node => !node.category)
                        if (uncategorizedRoots.length === 0) return null

                        return (
                            <div className="mb-2">
                                {CATEGORIES.some(c => tree.some(n => n.category === c.id)) && (
                                    <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider opacity-70 mt-3">
                                        Other
                                    </div>
                                )}
                                {uncategorizedRoots.map(node => (
                                    <TagItem key={node.id} node={node} />
                                ))}
                            </div>
                        )
                    })()}

                    {/* Add Tag Button */}
                    <button
                        onClick={() => createTag.mutate({ name: 'New Tag' })}
                        className="flex items-center gap-2 py-1.5 px-2 text-sm text-gray-400 hover:text-gray-600 w-full hover:bg-gray-50 rounded-md transition-colors mt-2"
                    >
                        <Plus size={14} />
                        <span>Add Tag</span>
                    </button>
                </div>
            </div>

            {/* Subtle Expand Handle (bottom) if we want explicit separate handle */}
            {!isExpanded && tags.length > 0 && (
                <div
                    onClick={() => setIsExpanded(true)}
                    className="h-1 w-full mx-auto bg-gray-100/50 hover:bg-gray-200 transition-colors cursor-pointer rounded-full mt-1 group flex items-center justify-center"
                    title="Expand Tags"
                >
                    <ChevronDown size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            )}
        </div>
    )
}
