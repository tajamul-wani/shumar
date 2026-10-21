import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AppClient, type AuthState } from './context.ts'

/** Tracks the signed-in session and keeps it current as Supabase refreshes or ends it. */
export function AuthProvider({ client, children }: { client: AppClient; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  const value = useMemo<AuthState>(() => ({ client, session, loading }), [client, session, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
