import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { Calendar, CheckSquare, LayoutDashboard, Menu, LogOut, ChevronRight } from "lucide-react"
import { useState } from "react"
import clsx from "clsx"
import { useTags } from "@/hooks/useTags"
import { supabase } from "@/lib/supabase"
import { TaskDetail } from "@/features/tasks/TaskDetail"
import { DailyPlanner } from "@/features/calendar/DailyPlanner"
import { Sidebar } from "@/shared/components/Sidebar"

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isTagsOpen, setIsTagsOpen] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('task')

  const { data: tags, isLoading: tagsLoading } = useTags()

  const navItems = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Tasks", path: "/tasks", icon: CheckSquare },
    { label: "Calendar", path: "/calendar", icon: Calendar },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="grid grid-cols-[260px_minmax(350px,1fr)_minmax(450px,1fr)_350px] h-screen overflow-hidden bg-gray-50">
      {/* Column A: Sidebar */}
      <aside className="bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between h-16 shrink-0 sticky top-0 bg-white z-10">
          <span className="font-bold text-xl text-blue-600">Pulse</span>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isActive ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Icon size={20} />
                <span className="whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            )
          })}

          <Sidebar activePath={location.pathname} />

          {/* Tags Section */}
          <div className="mt-8">
            <button
              onClick={() => setIsTagsOpen(!isTagsOpen)}
              className="w-full px-3 mb-2 flex items-center justify-between group hover:text-gray-600 outline-none"
            >
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider group-hover:text-gray-500 transition-colors">
                Tags
              </span>
              <ChevronRight
                size={16}
                className={clsx("text-gray-400 transition-transform duration-200", isTagsOpen && "rotate-90")}
              />
            </button>

            {isTagsOpen && (
              <div className="space-y-1">
                {tagsLoading ? (
                  <div className="px-3 space-y-2">
                    {[1, 2].map(i => <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />)}
                  </div>
                ) : tags?.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">
                    No tags yet
                  </div>
                ) : (
                  tags?.map(tag => (
                    <Link
                      key={tag.id}
                      to={`/tags/${tag.id}`}
                      className={clsx(
                        "flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-sm text-gray-600 hover:bg-gray-100",
                        location.pathname === `/tags/${tag.id}` && "bg-blue-50 text-blue-600"
                      )}
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="truncate">{tag.name}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100 mt-auto">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-red-600 w-full transition-colors"
          >
            <LogOut size={20} />
            <span className={clsx("whitespace-nowrap transition-opacity", !isSidebarOpen && "opacity-0 hidden")}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Column B: Task List */}
      <section className="border-r border-gray-200 bg-white overflow-y-auto">
        <Outlet />
      </section>

      {/* Column C: Detail View */}
      <section className="border-r border-gray-200 bg-white overflow-y-auto">
        {taskId ? (
          <TaskDetail taskId={taskId} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Select a task to view details
          </div>
        )}
      </section>

      {/* Column D: Calendar */}
      <section className="bg-white overflow-hidden border-l border-gray-200">
        <DailyPlanner />
      </section>
    </div>
  )
}
