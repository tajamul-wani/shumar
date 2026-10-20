import { useDocumentTitle } from '../shell/useDocumentTitle.ts'

/** Placeholder until the weekly and monthly views arrive with SHU-18. */
export function TrendsScreen() {
  useDocumentTitle('Trends')
  return (
    <>
      <h1 tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none">
        Trends
      </h1>
      <p className="m-0 text-body text-koshur-muted">Your week and month will show here.</p>
    </>
  )
}
