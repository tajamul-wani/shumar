/**
 * Theme handling. The preference (system, light or dark) is the only thing stored,
 * in localStorage: it's a display setting, not personal data. `public/theme-init.js`
 * applies the same rules before the page first draws, so it never flashes the wrong theme.
 */

import { deviceStorage } from './deviceStorage.ts'

export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'shumar-theme'
const LIGHT_QUERY = '(prefers-color-scheme: light)'

/** The choices in the order the You screen shows them, which is also the order the theme button cycles through. */
export const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark']

export const PREFERENCE_LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

export function nextPreference(preference: ThemePreference): ThemePreference {
  return PREFERENCES[(PREFERENCES.indexOf(preference) + 1) % PREFERENCES.length]
}

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>

/** Anything unknown or missing counts as "follow the device". */
export function parsePreference(value: string | null | undefined): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, deviceIsLight: boolean): Theme {
  if (preference === 'system') return deviceIsLight ? 'light' : 'dark'
  return preference
}

/** Storage can be blocked (private windows, strict settings); fall back to "system". */
export function readPreference(storage: ReadableStorage | undefined = deviceStorage()): ThemePreference {
  try {
    return parsePreference(storage?.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function savePreference(
  preference: ThemePreference,
  storage: WritableStorage | undefined = deviceStorage(),
): void {
  try {
    if (preference === 'system') storage?.removeItem(THEME_STORAGE_KEY)
    else storage?.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // The choice just won't be remembered; the theme still applies for this visit.
  }
}

/** Browsers without matchMedia count as dark, the app's default. */
export function systemPrefersLight(win: Partial<Pick<Window, 'matchMedia'>> = window): boolean {
  return win.matchMedia?.(LIGHT_QUERY).matches ?? false
}

/** Sets the theme on the page and matches the browser's status bar to the base color token. */
export function applyTheme(theme: Theme, doc: Document = document): void {
  const root = doc.documentElement
  root.dataset.theme = theme
  const base = getComputedStyle(root).getPropertyValue('--koshur-base').trim()
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta && base) meta.content = base
}

/** Calls `onChange` when the device switches between light and dark. Returns an unsubscribe function. */
export function watchSystemTheme(
  onChange: (prefersLight: boolean) => void,
  win: Partial<Pick<Window, 'matchMedia'>> = window,
): () => void {
  if (!win.matchMedia) return () => {}
  const query = win.matchMedia(LIGHT_QUERY)
  const listener = (event: MediaQueryListEvent) => onChange(event.matches)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
