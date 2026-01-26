import { useEffect, useState } from "react"
import { RouterProvider } from "react-router-dom"
import { App as CapacitorApp } from '@capacitor/app'
import { router } from "@/app/router"
import { QuickAddModal } from "@/features/tasks/QuickAddModal"
import { NativeSync } from "@/features/native-sync/NativeSync"
import { supabase } from "@/lib/supabase"

function App() {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)

  useEffect(() => {
    const handleUrl = async (url: string) => {
      console.log('[App] URL received:', url);

      // Handle quick-add deep link
      if (url.includes('pulse://quick-add')) {
        setIsQuickAddOpen(true)
        return
      }

      // Handle OAuth callback - extract tokens from URL
      // Supports both hash fragments (#access_token=) and our custom scheme (com.pulse.app://auth/callback)
      if (url.includes('access_token=') || url.includes('#access_token=') || url.includes('com.pulse.app://auth')) {
        console.log('[App] OAuth callback detected, processing tokens...');
        try {
          // Parse the URL to extract hash parameters
          const hashIndex = url.indexOf('#');
          if (hashIndex !== -1) {
            const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (accessToken) {
              console.log('[App] Setting session from URL tokens, hasRefreshToken:', !!refreshToken);
              // Let Supabase handle the session from URL
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              if (error) {
                console.error('[App] Error setting session:', error);
              } else {
                console.log('[App] Session set successfully from OAuth callback');
              }
            }
          }
        } catch (error) {
          console.error('[App] Error processing OAuth callback:', error);
        }
      }
    };

    CapacitorApp.addListener('appUrlOpen', data => {
      handleUrl(data.url);
    })

    CapacitorApp.getLaunchUrl().then(data => {
      if (data?.url) {
        handleUrl(data.url);
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
      <NativeSync />
      <RouterProvider router={router} />
    </>
  )
}

export default App
