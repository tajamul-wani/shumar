import { useState } from 'react'
import { formatDayHeading } from '../lib/dates.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'

/** The Today header from the V2 design. The dashboard itself arrives with SHU-17. */
export function TodayScreen() {
  useDocumentTitle('Today')
  // Read once when the screen opens, so re-renders never change the date mid-view.
  const [today] = useState(() => new Date())
  return (
    <>
      <header className="flex flex-col gap-1">
        <span lang="ks" aria-hidden="true" className="font-wordmark text-heading text-deficit-ring lg:hidden">
          شُمار
        </span>
        <p className="m-0 text-body text-koshur-muted lg:text-body-sm">{formatDayHeading(today)}</p>
        <h1
          tabIndex={-1}
          className="sr-only m-0 text-heading font-semibold focus:outline-none lg:not-sr-only"
        >
          Today
        </h1>
      </header>
      <p className="m-0 text-body text-koshur-muted">Your meals for today will show here.</p>
    </>
  )
}
