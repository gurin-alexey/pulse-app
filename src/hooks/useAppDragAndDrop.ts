import { useState } from 'react'
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
    type DragOverEvent
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useQueryClient } from '@tanstack/react-query'
import { useUpdateTask } from '@/hooks/useUpdateTask'
import { useMediaQuery } from '@/hooks/useMediaQuery'

import { useUpdateProject } from '@/hooks/useUpdateProject'
import { useCreateProjectGroup } from '@/hooks/useProjectGroups'

export function useAppDragAndDrop() {
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const queryClient = useQueryClient()
    const { mutate: updateTask } = useUpdateTask()
    const { mutate: updateProject } = useUpdateProject()
    const { mutate: createProjectGroup } = useCreateProjectGroup()


    // Drag state
    const [activeDragData, setActiveDragData] = useState<any>(null)

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    // Custom collision detection: prioritize sidebar items
    const customCollisionDetection = (args: any) => {
        const { pointerCoordinates } = args
        if (!pointerCoordinates) return closestCorners(args)

        // SIDEBAR ZONE: Exclusive area for sidebar targets (left 270px) - ONLY ON DESKTOP
        if (isDesktop && pointerCoordinates.x < 270) {
            const sidebarContainers = args.droppableContainers.filter((c: any) =>
                ['Nav', 'Project', 'ProjectSortable', 'Folder'].includes(c.data?.current?.type)
            )

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
    }

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragData(event.active.data.current)
    }

    const handleDragOver = (event: DragOverEvent) => {
        // Keep empty as per original implementation requirement or add logic if needed in future
    }

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveDragData(null)
        const { active, over } = event

        if (!over) return

        const activeData = active.data.current

        // --- 1. HANDLE TASKS ---
        if (activeData?.task) {
            const activeTask = activeData.task
            const overType = over.data.current?.type

            // Disable dropping tasks into sidebar lists/projects/folders
            if (overType === 'Nav' || overType === 'Project' || overType === 'Folder') {
                return
            }

            // Task -> Sidebar Project
            if (overType === 'Project') {
                const targetProjectId = over.id as string
                if (activeTask.project_id !== targetProjectId) {
                    updateTask({
                        taskId: activeTask.id,
                        updates: {
                            project_id: targetProjectId,
                            section_id: null,
                            parent_id: null,
                            sort_order: -new Date().getTime()
                        }
                    })
                }
            }

            // Task -> Sidebar Folder (Move to first project in folder)
            else if (overType === 'Folder') {
                const folder = over.data.current?.group
                if (folder) { // Ensure it's not root drop
                    const projectsInFolder = queryClient.getQueryData<any[]>(['projects'])?.filter(p => p.group_id === folder.id)
                    if (projectsInFolder && projectsInFolder.length > 0) {
                        updateTask({
                            taskId: activeTask.id,
                            updates: {
                                project_id: projectsInFolder[0].id,
                                section_id: null,
                                parent_id: null,
                                sort_order: -new Date().getTime()
                            }
                        })
                    }
                }
            }

            // Task -> Sidebar Nav (Inbox, Today)
            else if (overType === 'Nav') {
                const navLabel = over.data.current?.label
                const updates: any = {}

                if (navLabel === 'Inbox') {
                    updates.project_id = null
                    updates.section_id = null
                    updates.due_date = null
                } else if (navLabel === 'Today') {
                    updates.due_date = new Date().toISOString().split('T')[0]
                } else if (navLabel === 'Trash') {
                    updates.deleted_at = new Date().toISOString()
                }

                if (Object.keys(updates).length > 0) {
                    updateTask({
                        taskId: activeTask.id,
                        updates: {
                            ...updates,
                            parent_id: null,
                            sort_order: -new Date().getTime()
                        }
                    })
                }
            }
        }

        // --- 2. HANDLE PROJECTS ---
        else if (activeData?.type === 'Project' || activeData?.type === 'ProjectSortable') {
            const activeProject = activeData.project
            const overType = over.data.current?.type

            // Project -> Folder (Add to group)
            if (overType === 'Folder') {
                // Check if it's the Root drop zone
                if (over.data.current?.root) {
                    // Ungroup
                    if (activeProject.group_id) {
                        updateProject({ projectId: activeProject.id, updates: { group_id: null } })
                    }
                } else {
                    // Specific Folder
                    const folderId = over.id as string
                    if (activeProject.group_id !== folderId) {
                        updateProject({ projectId: activeProject.id, updates: { group_id: folderId } })
                    }
                }
            }

            // Project -> Project (ignore, handled by sortable reorder)
            else if (overType === 'Project' || overType === 'ProjectSortable') {
                return
            }
        }
    }

    return {
        activeDragData,
        sensors,
        customCollisionDetection,
        handleDragStart,
        handleDragOver,
        handleDragEnd
    }
}
