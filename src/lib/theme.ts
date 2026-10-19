/**
 * Theme handling. The preference (system, light or dark) is the only thing stored,
 * in localStorage: it's a display setting, not personal data. `public/theme-init.js`
 * applies the same rules before the page first draws, so it never flashes the wrong theme.
 */

export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'shumar-theme'
const LIGHT_QUERY = '(prefers-color-scheme: light)'

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
export function readPreference(
  storage: ReadableStorage | undefined = globalThis.localStorage,
): ThemePreference {
  try {
    return parsePreference(storage?.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function savePreference(
  preference: ThemePreference,
  storage: WritableStorage | undefined = globalThis.localStorage,
): void {
  try {
    if (preference === 'system') storage?.removeItem(THEME_STORAGE_KEY)
    else storage?.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // The choice just won't be remembered; the theme still applies for this visit.
  }
}

export function systemPrefersLight(win: Pick<Window, 'matchMedia'> = window): boolean {
  return win.matchMedia(LIGHT_QUERY).matches
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
  win: Pick<Window, 'matchMedia'> = window,
): () => void {
  const query = win.matchMedia(LIGHT_QUERY)
  const listener = (event: MediaQueryListEvent) => onChange(event.matches)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

/** Applies the saved preference now and keeps following the device while the preference is "system". */
export function startTheme(storage?: ReadableStorage, win: Pick<Window, 'matchMedia'> = window): () => void {
  const preference = readPreference(storage)
  applyTheme(resolveTheme(preference, systemPrefersLight(win)))
  if (preference !== 'system') return () => {}
  return watchSystemTheme((prefersLight) => applyTheme(resolveTheme('system', prefersLight)), win)
}
