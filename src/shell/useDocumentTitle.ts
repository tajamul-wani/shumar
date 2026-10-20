import { useEffect } from 'react'

/** Sets the browser tab title to "<screen> · Shumār", or just "Shumār" with no screen name. */
export function useDocumentTitle(screen?: string): void {
  useEffect(() => {
    document.title = screen ? `${screen} · Shumār` : 'Shumār'
  }, [screen])
}
