
import { Link, Outlet, useLocation } from "react-router-dom"
import { Calendar, CheckSquare, LayoutDashboard, Menu } from "lucide-react"
import { useState } from "react"
import clsx from "clsx"

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const location = useLocation()

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
                title={!isSidebarOpen ? item.label : undefined}
              >
                <Icon size={20} />
                <span className={clsx("whitespace-nowrap transition-opacity", !isSidebarOpen && "opacity-0 hidden")}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
