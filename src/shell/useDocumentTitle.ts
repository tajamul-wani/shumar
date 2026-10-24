import { useEffect } from 'react'
import { SITE_NAME, SITE_TITLE } from './site.ts'

/** Sets the browser tab title to "<screen> · Shumār", or the site's full title with no screen name. */
export function useDocumentTitle(screen?: string): void {
  useEffect(() => {
    document.title = screen ? `${screen} · ${SITE_NAME}` : SITE_TITLE
  }, [screen])
}
