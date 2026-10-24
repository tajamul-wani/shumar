import { useCallback, useSyncExternalStore } from 'react'

/** From this width the side navigation takes over, Today shows Add food beside the day and You uses two columns. */
export const DESKTOP_QUERY = '(min-width: 1024px)'

/** Whether a media query matches, kept up to date as the window changes. False where matchMedia is missing. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia?.(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(query).matches ?? false)
}
