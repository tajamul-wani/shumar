import { useDocumentTitle } from '../shell/useDocumentTitle.ts'

/** Where the add button leads. The log sheet itself arrives with SHU-15. */
export function LogFoodScreen() {
  useDocumentTitle('Add food')
  return (
    <>
      <h1 tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none">
        Add food
      </h1>
      <p className="m-0 text-body text-koshur-muted">Food search and logging will show here.</p>
    </>
  )
}
