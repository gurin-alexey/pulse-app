import { useEffect, useState } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'

export function Login() {
    const navigate = useNavigate()
    const [session, setSession] = useState<any>(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            if (session) {
                navigate('/')
            }
        })

        return () => subscription.unsubscribe()
    }, [navigate])

    if (session) {
        return null
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-sm border border-gray-100">
                <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Welcome back</h1>
                <Auth
                    supabaseClient={supabase}
                    appearance={{ theme: ThemeSupa }}
                    providers={[]}
                    theme="light"
                />
            </div>
        </div>
    )
}
