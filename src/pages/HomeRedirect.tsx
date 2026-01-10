import { Navigate } from "react-router-dom"
import { useSettings } from "@/store/useSettings"
import { DashboardPage } from "@/pages/DashboardPage"

export function HomeRedirect() {
    const { settings, isLoading } = useSettings()

    if (isLoading) {
        return null // Or a loading spinner if desired, but null avoids flash
    }

    const defaultPage = settings?.preferences?.default_page || 'today'

    if (defaultPage === 'today') {
        return <Navigate to="/today" replace />
    }
    if (defaultPage === 'calendar') {
        return <Navigate to="/calendar" replace />
    }

    // If default is dashboard, render it or redirect to /dashboard
    // Since we are adding a /dashboard route, let's redirect to it for consistency
    return <Navigate to="/dashboard" replace />
}
