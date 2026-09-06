import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { requireSupabase, isSupabaseConfigured, supabase } from '../services/supabase'

type AuthProvider = 'google' | 'discord'

interface AuthContextValue {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  signIn: (provider: AuthProvider) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return

    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setLoading(false)
        restorePendingCombo(data.session)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      restorePendingCombo(nextSession)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (provider: AuthProvider) => {
    const client = requireSupabase()
    // GitHub Pages cannot serve an OAuth callback route. Return to the static
    // site root, then restore the simulator hash route after Supabase exchanges
    // the authorization code.
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
    const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const client = requireSupabase()
    const { error } = await client.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    signIn,
    signOut,
  }), [loading, session, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function restorePendingCombo(session: Session | null) {
  const compressed = sessionStorage.getItem('pendingComboState')
  if (!session || sessionStorage.getItem('pendingComboPublish') !== 'true' || !compressed || window.location.hash.startsWith('#/sim')) return
  window.location.assign(`${window.location.origin}${import.meta.env.BASE_URL}#/sim?d=${compressed}`)
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
