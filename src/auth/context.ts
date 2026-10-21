import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

/** The parts of the Supabase client the app uses: sign-in, table reads and database functions. */
export type AppClient = Pick<SupabaseClient, 'auth' | 'from' | 'rpc'>

export interface AuthState {
  client: AppClient
  session: Session | null
  loading: boolean
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
