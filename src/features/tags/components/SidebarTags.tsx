import { useState, useMemo } from 'react'
import { useTags } from '../hooks/useTags'
import { useTagMutations } from '../hooks/useTagMutations'
import { ChevronDown, ChevronRight, Hash, MoreHorizontal, Plus, Trash2, Edit2, CornerDownRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import type { Tag } from '@/types/database'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

const TagItem = ({ node, level = 0 }: { node: TreeNode, level?: number }) => {
    const location = useLocation()
    const isActive = location.pathname === `/tags/${node.id}`
    const { deleteTag, updateTag } = useTagMutations()
    const [isHovered, setIsHovered] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState(node.name)

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
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

    return (
        <div>
            <div
                className={clsx(
                    "group flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors text-sm relative",
                    isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
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

                {/* Actions (Only on hover) */}
                <div className={clsx("flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity", isEditing && "hidden")}>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-1 text-gray-400 hover:text-blue-600 rounded"
                        title="Rename"
                    >
                        <Edit2 size={12} />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Delete"
                    >
                        <Trash2 size={12} />
                    </button>
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

export function SidebarTags() {
    const { data: tags } = useTags()
    const { createTag } = useTagMutations()
    const [isExpanded, setIsExpanded] = useState(false)

    // Transform flat list to tree
    const tree = useMemo(() => tags ? buildTree(tags) : [], [tags])

    // We might want to show top-level tags by default, or collapse everything?
    // Requirement says: "Click: Smoothly expands". This implies it's collapsed by default.
    // Let's assume initially collapsed or only showing a few?
    // "Default state: collapsed or showing only top level" -> Let's show collapsed mostly.

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
                isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="space-y-0.5 pb-4">
                    {tree.map(node => (
                        <TagItem key={node.id} node={node} />
                    ))}

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
