import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { Menu, LogOut, ChevronRight, Trash2, Settings } from "lucide-react"
import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import clsx from "clsx"
import { supabase } from "@/lib/supabase"
import { TaskDetail } from "@/features/tasks/TaskDetail"
import { TaskDetailModal } from "@/features/tasks/TaskDetailModal"
import { DailyPlanner } from "@/features/calendar/DailyPlanner"
import { Sidebar, DroppableNavItem } from "@/shared/components/Sidebar"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useProjects } from "@/hooks/useProjects"
import { useProjectGroups } from "@/hooks/useProjectGroups"
import { useUpdateProject } from "@/hooks/useUpdateProject"
import { TaskItem } from "@/features/tasks/TaskItem"
import { createPortal } from "react-dom"
import { useUpdateTask } from "@/hooks/useUpdateTask"
import { DndContext, useSensor, useSensors, MouseSensor, TouchSensor, KeyboardSensor, type DragEndEvent, closestCorners, closestCenter, DragOverlay } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Toaster } from "sonner"
import { SettingsModal } from "@/features/settings/SettingsModal"
import { useSettings } from "@/store/useSettings"
import { usePrefetchData } from "@/hooks/usePrefetchData"
import { useSelectionStore } from "@/store/useSelectionStore"
import { BulkActionsPanel } from "@/features/tasks/BulkActionsPanel"
import { ChatWidget } from "@/features/ai/ChatWidget"
import { GlobalSearch } from "@/features/search/GlobalSearch"

export function Layout() {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { selectedIds } = useSelectionStore()

  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const taskId = searchParams.get('task')

  const { fetchSettings } = useSettings()

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // Prefetching Strategy
  usePrefetchData()
  const queryClient = useQueryClient()

  const isCalendarPage = location.pathname.startsWith('/calendar')
  const isDashboardPage = location.pathname === '/'

  const closeModal = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('task')
    setSearchParams(newParams)
  }


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
        ['Nav', 'Project', 'Folder'].includes(c.data?.current?.type)
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

  // Global Mutations
  const { mutate: updateTask } = useUpdateTask()

  // Drag state
  const [activeTask, setActiveTask] = useState<any>(null)

  const handleDragStart = (event: any) => {
    setActiveTask(event.active.data.current?.task)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    // ... rest of existing logic
    if (!over) return
    // ...
    const activeTask = active.data.current?.task
    if (!activeTask) return

    const overType = over.data.current?.type

    // 1. Task -> Sidebar Project
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

    // 2. Task -> Sidebar Folder (Move to first project in folder)
    else if (overType === 'Folder') {
      const folder = over.data.current?.group
      const projectsInFolder = queryClient.getQueryData<any[]>(['projects'])?.filter(p => p.group_id === folder?.id)

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

    // 3. Task -> Sidebar Nav (Inbox, Today)
    else if (overType === 'Nav') {
      const navLabel = over.data.current?.label
      const updates: any = {}

      if (navLabel === 'Inbox') {
        updates.project_id = null
        updates.section_id = null
        updates.due_date = null
      } else if (navLabel === 'Today') {
        updates.due_date = new Date().toISOString().split('T')[0]
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

  const handleDragOver = (event: any) => {
    // ...
  }



  function renderLogout() {
    return (
      <div className="p-4 border-t border-gray-100 mt-auto space-y-1">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-blue-600 w-full transition-colors"
        >
          <Settings size={20} />
          <span className="whitespace-nowrap transition-opacity font-medium">Settings</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-red-600 w-full transition-colors"
        >
          <LogOut size={20} />
          <span className="whitespace-nowrap transition-opacity font-medium">Logout</span>
        </button>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex h-screen overflow-hidden bg-gray-50 flex-col md:flex-row">
        {/* Mobile Top Header */}
        <header className="md:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-30 pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-xl text-blue-600">Pulse</span>
          <div className="w-10"></div> {/* Spacer for symmetry */}
        </header>

        {/* Column A: Sidebar (Desktop) */}
        <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col overflow-y-auto shrink-0">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between h-16 shrink-0 sticky top-0 bg-white z-10">
            <span className="font-bold text-xl text-blue-600">Pulse</span>
          </div>
          <nav className="flex-1 space-y-1">
            <Sidebar activePath={location.pathname} />
            <div className="mt-auto pt-4 pb-2">
              <DroppableNavItem label="Trash">
                {(isOver) => (
                  <Link
                    to="/trash"
                    onClick={() => setIsSidebarOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 px-5 py-2.5 transition-colors",
                      isOver ? "text-white bg-red-500" : (location.pathname === '/trash' ? "text-red-600 bg-red-50" : "text-gray-500 hover:text-red-600 hover:bg-red-50")
                    )}
                  >
                    <Trash2 size={20} />
                    <span className="whitespace-nowrap font-semibold">Trash</span>
                  </Link>
                )}
              </DroppableNavItem>
            </div>
          </nav>
          {renderLogout()}
        </aside>

        {/* Mobile Sidebar Overlay + Drawer */}
        {(isSidebarOpen && !isDesktop) && (
          <>
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 w-[280px] bg-white z-50 md:hidden flex flex-col animate-in slide-in-from-left duration-300">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between h-16 shrink-0 pt-[env(safe-area-inset-top)]">
                <span className="font-bold text-xl text-blue-600">Pulse</span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 -ml-2 text-gray-400"
                >
                  <ChevronRight size={24} className="rotate-180" />
                </button>
              </div>
              <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                <Sidebar
                  activePath={location.pathname}
                  onItemClick={() => setIsSidebarOpen(false)}
                />
                <div className="mt-auto pt-4 pb-2">
                  <DroppableNavItem label="Trash">
                    {(isOver) => (
                      <Link
                        to="/trash"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                          "flex items-center gap-3 px-5 py-2.5 transition-colors",
                          isOver ? "text-white bg-red-500" : (location.pathname === '/trash' ? "text-red-600 bg-red-50" : "text-gray-500 hover:text-red-600 hover:bg-red-50")
                        )}
                      >
                        <Trash2 size={20} />
                        <span className="whitespace-nowrap font-semibold">Trash</span>
                      </Link>
                    )}
                  </DroppableNavItem>
                </div>
              </nav>
              {renderLogout()}
            </aside>
          </>
        )}


        <main className={clsx(
          "flex-1 flex overflow-hidden",
          isCalendarPage ? "" :
            isDashboardPage ? "lg:grid lg:grid-cols-[1fr_350px]" : // Dashboard: 2 cols (Wide Content + Planner)
              "lg:grid lg:grid-cols-[minmax(350px,1fr)_minmax(450px,1fr)_350px]" // Standard: 3 cols
        )}>

          {/* List Column (Takes up first slot. If Dashboard, takes up slot 1 which is 1fr wide) */}
          <section className={clsx(
            "bg-white overflow-y-auto border-r border-gray-200 h-full",
            isCalendarPage ? "w-full" :
              isDashboardPage ? "col-span-1" :
                "flex-1 lg:flex-none"
          )}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </section>

          {/* Detail Column (Desktop Only as a col, unless task is selected) */}
          {/* HIDE this column on Dashboard Page since Dashboard takes that space */}
          {(!isCalendarPage && !isDashboardPage) && (
            <section className={clsx(
              "border-r border-gray-200 bg-white overflow-y-auto h-full hidden lg:block"
            )}>
              {selectedIds.size > 1 ? (
                <BulkActionsPanel />
              ) : taskId ? (
                <TaskDetail taskId={taskId} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  Select a task to view details
                </div>
              )}
            </section>
          )}

          {/* Planner Column (Desktop Only) */}
          {!isCalendarPage && (
            <section className="bg-white overflow-hidden border-l border-gray-200 hidden xl:block w-[350px]">
              <DailyPlanner />
            </section>
          )}
        </main>

        {/* Modal for Calendar Page OR Mobile List View */}
        {taskId && (isCalendarPage || !isDesktop) && (
          <TaskDetailModal taskId={taskId} onClose={closeModal} />
        )}

        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <ChatWidget />
        <GlobalSearch />
      </div>

      <Toaster position="bottom-center" richColors />

      {/* Global Drag Overlay */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="opacity-90 rotate-2 cursor-grabbing pointer-events-none">
              <TaskItem task={activeTask} isActive={true} />
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  )
}
