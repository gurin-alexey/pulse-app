
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { Calendar, CheckSquare, LayoutDashboard, Menu, Folder, AlertCircle, LogOut } from "lucide-react"
import { useState } from "react"
import clsx from "clsx"
import { useProjects } from "@/hooks/useProjects"
import { supabase } from "@/lib/supabase"

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()
  const { data: projects, isLoading, isError } = useProjects()

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

          <div className="mt-8">
            <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Projects
            </div>

            {isLoading ? (
              <div className="px-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : isError ? (
              <div className="px-3 py-2 text-sm text-red-500 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>Error loading</span>
              </div>
            ) : (
              <div className="space-y-1">
                {projects?.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-gray-600 hover:bg-gray-100",
                      location.pathname === `/projects/${project.id}` && "bg-blue-50 text-blue-600"
                    )}
                  >
                    <Folder size={20} />
                    <span className="whitespace-nowrap truncate">
                      {project.name}
                    </span>
                  </Link>
                ))}
                {projects?.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-400">
                    No projects yet
                  </div>
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

      {/* Column C: Detail View (Placeholder) */}
      <section className="border-r border-gray-200 bg-white overflow-y-auto">
        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
          Select a task to view details
        </div>
      </section>

      {/* Column D: Calendar (Placeholder) */}
      <section className="bg-gray-50 overflow-y-auto">
        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
          Calendar view
        </div>
      </section>
    </div>
  )
}

