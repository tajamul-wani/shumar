import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyTheme,
  readPreference,
  resolveTheme,
  savePreference,
  systemPrefersLight,
  watchSystemTheme,
  type ThemePreference,
} from '../lib/theme.ts'
import { ThemeContext, type ThemeState } from './context.ts'

/** Keeps the page theme in step with the saved choice and, for "system", with the device. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference())
  const [deviceIsLight, setDeviceIsLight] = useState(() => systemPrefersLight())

  useEffect(() => watchSystemTheme(setDeviceIsLight), [])

  const theme = resolveTheme(preference, deviceIsLight)
  useEffect(() => applyTheme(theme), [theme])

  const setPreference = useCallback((next: ThemePreference) => {
    savePreference(next)
    setPreferenceState(next)
  }, [])

  const value = useMemo<ThemeState>(
    () => ({ preference, theme, setPreference }),
    [preference, theme, setPreference],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
