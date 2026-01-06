import { useEffect, useState } from "react"
import { RouterProvider } from "react-router-dom"
import { App as CapacitorApp } from '@capacitor/app'
import { router } from "@/app/router"
import { QuickAddModal } from "@/features/tasks/QuickAddModal"

function App() {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)

  useEffect(() => {
    CapacitorApp.addListener('appUrlOpen', data => {
      if (data.url.includes('pulse://quick-add')) {
        setIsQuickAddOpen(true)
      }
    })

    CapacitorApp.getLaunchUrl().then(data => {
      if (data?.url.includes('pulse://quick-add')) {
        setIsQuickAddOpen(true)
      }
    })
  }, [])

  const handleClose = () => {
    setIsQuickAddOpen(false)
    // If we were in quick add mode, we likely want to minimize/close the app 
    // instead of dropping user into the main app.
    // But since we are single-instance, maybe we just want to hide the modal?
    // User said "only a small field", implies they don't want to see the app.
    // So let's exit app.
    CapacitorApp.exitApp()
  }

  if (isQuickAddOpen) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <QuickAddModal isOpen={true} onClose={handleClose} />
      </div>
    )
  }

  return (
    <>
      <RouterProvider router={router} />
    </>
  )
}

export default App
