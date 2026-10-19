import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export interface AuthState {
  client: Pick<SupabaseClient, 'auth'>
  session: Session | null
  loading: boolean
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
