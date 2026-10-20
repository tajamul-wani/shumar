import { createContext, useContext } from 'react'
import type { Theme, ThemePreference } from '../lib/theme.ts'

export interface ThemeState {
  preference: ThemePreference
  theme: Theme
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme(): ThemeState {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
