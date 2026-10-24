import { createContext, useContext } from 'react'
import type { FirstRunAnswers } from '../lib/firstRun.ts'

export interface ProfileState {
  /** The saved first-run answers, or null when the person hasn't answered yet. */
  answers: FirstRunAnswers | null
  status: 'loading' | 'ready' | 'error'
  error: string | null
  reload: () => void
}

export const ProfileContext = createContext<ProfileState | null>(null)

export function useProfile(): ProfileState {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('useProfile must be used inside ProfileProvider')
  return value
}
