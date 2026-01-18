import { useState, useMemo, useCallback } from 'react'
import {
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    KeyboardSensor,
    type DragEndEvent,
    closestCorners,
    closestCenter,
    type DragStartEvent,
    type DragOverEvent,
    type CollisionDetection
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useQueryClient } from '@tanstack/react-query'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useMediaQuery } from '@/hooks/useMediaQuery'

import { useUpdateProject } from '@/hooks/useUpdateProject'
import { useCreateProjectGroup } from '@/hooks/useProjectGroups'

interface DragData {
    type: 'Task' | 'Project' | 'ProjectSortable' | 'Folder' | 'Nav' | 'Section'
    task?: any
    project?: any
    group?: any
    section?: any
    label?: string
}

export function useAppDragAndDrop() {
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const queryClient = useQueryClient()
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: updateProject } = useUpdateProject()
    const { mutate: createProjectGroup } = useCreateProjectGroup()


    // Drag state
    const [activeDragData, setActiveDragData] = useState<DragData | null>(null)

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    // Custom collision detection: prioritize sidebar items
    const customCollisionDetection: CollisionDetection = useCallback((args) => {
        const { pointerCoordinates } = args
        if (!pointerCoordinates) return closestCorners(args)

        // SIDEBAR ZONE: Exclusive area for sidebar targets (left 270px) - ONLY ON DESKTOP
        const activeType = args.active.data.current?.type
        if (isDesktop && pointerCoordinates.x < 270 && activeType !== 'Task') {
            const sidebarContainers = args.droppableContainers.filter((c) => {
                const type = c.data?.current?.type
                return ['Project', 'ProjectSortable', 'Folder'].includes(type)
            })

            // Use closestCenter for magnetic feel
            const collisions = closestCenter({
                ...args,
                droppableContainers: sidebarContainers
            })

            if (collisions.length > 0) {
                return collisions
            }

            // If in sidebar zone but nothing found, return empty to avoid hitting background list
            return []
        }

        // Default behavior for the task list
        return closestCorners(args)
    }, [isDesktop])

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveDragData(event.active.data.current as DragData)
    }, [])

    const handleDragOver = useCallback((event: DragOverEvent) => {
        // Implementation if needed
    }, [])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setActiveDragData(null)
        const { active, over } = event

        if (!over) return

        const activeData = active.data.current as DragData
        const overData = over.data.current as DragData

        // --- 1. HANDLE PROJECTS ---
        if (activeData?.type === 'Project' || activeData?.type === 'ProjectSortable') {
            const activeProject = activeData.project
            const overType = overData?.type

            // Project -> Folder (Add to group)
            if (overType === 'Folder') {
                // Check if it's the Root drop zone
                if (overData.group?.root || over.id === 'projects-root') {
                    // Ungroup
                    if (activeProject.group_id) {
                        updateProject({ projectId: activeProject.id, updates: { group_id: null } })
                    }
                } else {
                    // Specific Folder
                    const folderId = (overData.group?.id || over.id) as string
                    if (activeProject.group_id !== folderId) {
                        updateProject({ projectId: activeProject.id, updates: { group_id: folderId } })
                    }
                }
            }
        }
    }, [updateTask, updateProject, queryClient])

    return {
        activeDragData,
        sensors,
        customCollisionDetection,
        handleDragStart,
        handleDragOver,
        handleDragEnd
    }
}

