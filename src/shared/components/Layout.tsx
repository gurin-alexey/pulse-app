
import { Link, Outlet, useLocation } from "react-router-dom"
import { Calendar, CheckSquare, LayoutDashboard, Menu, Folder, AlertCircle } from "lucide-react"
import { useState } from "react"
import clsx from "clsx"
import { useProjects } from "@/hooks/useProjects"

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const location = useLocation()
  const { data: projects, isLoading, isError } = useProjects()

  const navItems = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Tasks", path: "/tasks", icon: CheckSquare },
    { label: "Calendar", path: "/calendar", icon: Calendar },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={clsx(
          "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col",
          isSidebarOpen ? "w-64" : "w-16"
        )}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between h-16">
          <span className={clsx("font-bold text-xl text-blue-600 transition-opacity", !isSidebarOpen && "opacity-0 hidden")}>Pulse</span>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
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
                title={!isSidebarOpen ? item.label : undefined}
              >
                <Icon size={20} />
                <span className={clsx("whitespace-nowrap transition-opacity", !isSidebarOpen && "opacity-0 hidden")}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          <div className="mt-8">
            <div className={clsx("px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider transition-opacity", !isSidebarOpen && "opacity-0 hidden")}>
              Projects
            </div>

            {isLoading ? (
              <div className="px-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : isError ? (
              <div className={clsx("px-3 py-2 text-sm text-red-500 flex items-center gap-2", !isSidebarOpen && "justify-center")}>
                <AlertCircle size={16} />
                <span className={clsx("whitespace-nowrap", !isSidebarOpen && "opacity-0 hidden")}>Error loading</span>
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
                    title={!isSidebarOpen ? project.name : undefined}
                  >
                    <Folder size={20} />
                    <span className={clsx("whitespace-nowrap transition-opacity truncate", !isSidebarOpen && "opacity-0 hidden")}>
                      {project.name}
                    </span>
                  </Link>
                ))}
                {projects?.length === 0 && (
                  <div className={clsx("px-3 py-2 text-sm text-gray-400", !isSidebarOpen && "opacity-0 hidden")}>
                    No projects yet
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
