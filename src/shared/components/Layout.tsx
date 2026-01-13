import { Link, Outlet, useLocation, useNavigate, useSearchParams, matchPath, useOutlet } from "react-router-dom"
import { Menu, LogOut, ChevronRight, Trash2, Settings, GripVertical, Plus, RefreshCw, Search } from "lucide-react"
import { useState, useEffect } from "react"
import { useQueryClient, useIsFetching } from "@tanstack/react-query"
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion"
import clsx from "clsx"
import { supabase } from "@/lib/supabase"
import { TaskDetail } from "@/features/tasks/TaskDetail"
import { TaskDetailModal } from "@/features/tasks/TaskDetailModal"
import { DailyPlanner } from "@/features/calendar/DailyPlanner"
import { Sidebar, DroppableNavItem } from "@/shared/components/Sidebar"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { TaskItem } from "@/features/tasks/TaskItem"
import { createPortal } from "react-dom"
import { useCreateTask } from "@/hooks/useCreateTask"
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { Toaster } from "sonner"
import { SettingsModal } from "@/features/settings/SettingsModal"
import { useSettings } from "@/store/useSettings"
import { usePrefetchData } from "@/hooks/usePrefetchData"
import { useTasksRealtime } from "@/hooks/useTasksRealtime"
import { useSelectionStore } from "@/store/useSelectionStore"
import { useProjects } from "@/hooks/useProjects"
import { BulkActionsPanel } from "@/features/tasks/BulkActionsPanel"
import { useAppDragAndDrop } from "@/hooks/useAppDragAndDrop"
import Logo from "@/assets/pulse_logo.jpg"

import { GlobalSearch } from "@/features/search/GlobalSearch"
import { useCommandStore } from "@/store/useCommandStore"
import { useSwipeable } from 'react-swipeable'

export function Layout() {
  const queryClient = useQueryClient()
  const isFetching = useIsFetching()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { selectedIds } = useSelectionStore()

  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const taskId = searchParams.get('task')
  const isNew = searchParams.get('isNew') === 'true'
  const currentOutlet = useOutlet()

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
  // Realtime Subscriptions
  useTasksRealtime()

  // Motion & Swipe Logic for Sidebar
  const drawerWidth = 280
  const sidebarX = useMotionValue(-drawerWidth)
  const backdropOpacity = useTransform(sidebarX, [-drawerWidth, 0], [0, 1])
  const backdropPointerEvents = useTransform(sidebarX, (v) => v > -drawerWidth + 10 ? 'auto' : 'none')

  // Sync state -> animation
  useEffect(() => {
    if (isDesktop) return
    const targetX = isSidebarOpen ? 0 : -drawerWidth
    animate(sidebarX, targetX, {
      type: "spring",
      stiffness: 400,
      damping: 40
    })
  }, [isSidebarOpen, isDesktop])

  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      if (isDesktop || isCalendarPage) return
      const target = e.event.target as HTMLElement
      // Prevent sidebar swipe if interacting with a task or if dragging section
      if (target.closest('[data-task-swipe-area="true"]')) return

      // Disable swipe if task detail is open
      if (taskId) return

      // Ignore vertical swipes to prevent accidental sidebar movement during scroll
      if (e.dir === 'Up' || e.dir === 'Down') return

      // Calculate new X based on start state
      // We assume if isOpen=true, base is 0. If false, base is -280.
      const base = isSidebarOpen ? 0 : -drawerWidth
      const nextX = Math.min(0, Math.max(-drawerWidth, base + e.deltaX))
      sidebarX.set(nextX)
    },
    onSwiped: (e) => {
      if (isDesktop || isCalendarPage) return
      const target = e.event.target as HTMLElement
      if (target.closest('[data-task-swipe-area="true"]')) return
      if (taskId) return

      const currentX = sidebarX.get()
      const shouldOpen = currentX > -(drawerWidth / 2) || (e.velocity > 0.4 && e.dir === 'Right')

      setIsSidebarOpen(shouldOpen)

      // Swipe Left to Open Search
      if (!isSidebarOpen && e.dir === 'Left' && Math.abs(e.deltaX) > 50) {
        useCommandStore.getState().setOpen(true)
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 10 // Minimum distance to start tracking
  })

  const isCalendarPage = location.pathname.startsWith('/calendar')
  const isDashboardPage = location.pathname === '/'

  const closeModal = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('task')
    newParams.delete('isNew')
    setSearchParams(newParams, { replace: true })
  }

  // Context Awareness for Mobile Title & FAB
  const matchProject = matchPath("/projects/:projectId", location.pathname)
  const projectId = matchProject?.params.projectId
  const { data: projects } = useProjects()
  const currentProject = projects?.find(p => p.id === projectId)

  const isInbox = location.pathname === '/inbox'
  const isToday = location.pathname === '/today'
  const isTomorrow = location.pathname === '/tomorrow'
  const isTrash = location.pathname === '/trash'
  const isTag = location.pathname.startsWith('/tags/')

  const mobileTitle = isCalendarPage ? null
    : isInbox ? "Inbox"
      : isToday ? "Today"
        : isTomorrow ? "Tomorrow"
          : isTrash ? "Trash"
            : isTag ? "Tag"
              : currentProject ? currentProject.name
                : "Pulse"

  // Drag and drop logic extracted to custom hook
  const {
    activeDragData,
    sensors,
    customCollisionDetection,
    handleDragStart,
    handleDragEnd,
    handleDragOver
  } = useAppDragAndDrop()

  // Global Mutations
  const { mutate: createTask } = useCreateTask()

  const handleCreateTask = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const newId = crypto.randomUUID()
    setSearchParams({ task: newId, isNew: 'true' })

    // Determine default date
    let defaultDate = null
    if (isToday) {
      const d = new Date()
      const offset = d.getTimezoneOffset()
      defaultDate = new Date(d.getTime() - (offset * 60000)).toISOString().split('T')[0]
    } else if (isTomorrow) {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      const offset = d.getTimezoneOffset()
      defaultDate = new Date(d.getTime() - (offset * 60000)).toISOString().split('T')[0]
    }

    createTask({
      id: newId,
      title: '',
      userId: user.id,
      projectId: projectId || null,
      due_date: defaultDate
    })
  }

  function renderSidebarFooter() {
    return (
      <div className="p-2 border-t border-gray-100 mt-auto flex items-center justify-around">
        <DroppableNavItem label="Trash" className="rounded-lg border-none">
          {(isOver) => (
            <Link
              to="/trash"
              onClick={() => setIsSidebarOpen(false)}
              className={clsx(
                "p-2 rounded-lg transition-colors flex items-center justify-center w-10 h-10",
                isOver ? "bg-red-100 text-red-600" : (location.pathname === '/trash' ? "text-red-600" : "text-gray-400 hover:text-red-500 hover:bg-red-50")
              )}
              title="Trash"
            >
              <Trash2 size={20} />
            </Link>
          )}
        </DroppableNavItem>

        <button
          onClick={() => queryClient.invalidateQueries()}
          className={clsx(
            "p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors",
            isFetching > 0 && "animate-spin text-blue-600 bg-blue-50"
          )}
          title="Sync"
          disabled={isFetching > 0}
        >
          <RefreshCw size={20} />
        </button>

        <button
          onClick={() => {
            setIsSettingsOpen(true)
            setIsSidebarOpen(false)
          }}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Settings"
        >
          <Settings size={20} />
        </button>

        <button
          onClick={() => {
            useCommandStore.getState().toggle()
            setIsSidebarOpen(false)
          }}
          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Search"
        >
          <Search size={20} />
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
      <div {...swipeHandlers} className="flex h-screen overflow-hidden bg-gray-50 flex-col md:flex-row">
        {/* Mobile Top Header */}
        <header className="md:hidden min-h-16 h-auto bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-[60] pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} />
          </button>

          <div className="flex-1 flex justify-center items-center font-bold text-xl text-blue-600 truncate px-2">
            <div id="mobile-header-title" className={isCalendarPage ? 'contents' : 'hidden'} />
            {!isCalendarPage && mobileTitle}
          </div>

          <div id="mobile-header-right" className="w-10 flex justify-end items-center">
            {/* Calendar Settings will be ported here */}
          </div>
        </header>

        {/* Column A: Sidebar (Desktop) */}
        <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col overflow-y-auto shrink-0">
          <div className="p-4 border-b border-gray-100 flex items-center justify-start gap-3 h-16 shrink-0 sticky top-0 bg-white z-10">
            <img src={Logo} alt="Pulse Logo" className="w-8 h-8" />
            <span className="font-extrabold text-2xl text-blue-600 italic uppercase tracking-tight">Pulse</span>
          </div>
          <nav className="flex-1 space-y-1 mt-8">
            <Sidebar activePath={location.pathname} />
          </nav>
          {renderSidebarFooter()}
        </aside>

        {/* Mobile Sidebar Overlay + Drawer */}
        {/* Mobile Sidebar (Permanent but animated) */}
        {!isDesktop && (
          <>
            <motion.div
              style={{ opacity: backdropOpacity, pointerEvents: backdropPointerEvents }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.aside
              style={{ x: sidebarX }}
              className="fixed inset-y-0 left-0 w-[280px] bg-white z-[100] md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between min-h-16 h-auto shrink-0 pt-[env(safe-area-inset-top)]">
                <div className="flex items-center gap-3">
                  <img src={Logo} alt="Pulse Logo" className="w-8 h-8" />
                  <span className="font-extrabold text-2xl text-blue-600 italic uppercase tracking-tight">Pulse</span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 -ml-2 text-gray-400"
                  title="Close Menu"
                >
                  <ChevronRight size={24} className="rotate-180" />
                </button>
              </div>
              <nav className="flex-1 p-2 space-y-1 overflow-y-auto mt-2">
                <Sidebar
                  activePath={location.pathname}
                  onItemClick={() => setIsSidebarOpen(false)}
                />
              </nav>
              {renderSidebarFooter()}
            </motion.aside>
          </>
        )}


        <main className="relative flex-1 overflow-hidden">
          <AnimatePresence initial={false}>
            {isCalendarPage ? (
              <motion.div
                key="calendar-view"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={isCalendarPage ? { x: "100%", zIndex: 50, transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } } : { opacity: 1, zIndex: 1, transition: { duration: 1.2 } }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 z-50 bg-white"
              >
                {currentOutlet}
              </motion.div>
            ) : (
              <motion.div
                key="standard-view"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
                className="h-full w-full bg-white"
              >
                <div className={clsx(
                  "h-full",
                  isDashboardPage
                    ? "lg:grid lg:grid-cols-[1fr_350px]"
                    : "lg:grid lg:grid-cols-[minmax(350px,1fr)_minmax(450px,1fr)_350px]"
                )}>
                  {/* List/Dashboard Column */}
                  <section className={clsx(
                    "bg-white overflow-y-auto border-r border-gray-200 h-full",
                    isDashboardPage ? "col-span-1" : "flex-1 lg:flex-none"
                  )}>
                    {currentOutlet}
                  </section>

                  {/* Detail Column (Standard Only) */}
                  {!isDashboardPage && (
                    <section className="border-r border-gray-200 bg-white overflow-y-auto h-full hidden lg:block">
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

                  {/* Planner Column (Always visible in Standard/Dashboard view, on the right) */}
                  <section className="bg-white overflow-hidden border-l border-gray-200 hidden xl:block w-[350px]">
                    <DailyPlanner />
                  </section>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Modal for Calendar Page OR Mobile List View OR Dashboard Page OR New Task (FAB) */}
        {taskId && (isCalendarPage || isDashboardPage || !isDesktop || isNew) && (
          <TaskDetailModal taskId={taskId} onClose={closeModal} />
        )}

        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />


        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCreateTask}
          className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center z-50 transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          <Plus size={36} />
        </motion.button>

        <GlobalSearch />
      </div>

      <Toaster position="bottom-center" richColors />

      {/* Global Drag Overlay */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeDragData?.type === 'Task' ? (
            <div className="opacity-100 cursor-grabbing pointer-events-none scale-100">
              <TaskItem task={activeDragData.task} isActive={true} />
            </div>
          ) : activeDragData?.type === 'Section' ? (
            <div className="opacity-100 cursor-grabbing pointer-events-none bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-64 scale-100">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-gray-400" />
                <h3 className="font-bold text-sm text-gray-800">{activeDragData.section.name}</h3>
              </div>
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  )
}
