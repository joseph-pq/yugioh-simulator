import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { loading, session } = useAuth()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (code && supabase) void supabase.auth.exchangeCodeForSession(code)
  }, [])

  useEffect(() => {
    if (!loading) navigate(session ? '/sim' : '/', { replace: true })
  }, [loading, navigate, session])

  return <div className="p-8 text-center text-[var(--color-text-secondary)]">Completing sign-in…</div>
}
