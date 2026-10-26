import { LogSheet } from '../log/LogSheet.tsx'
import { useSavedMeals } from '../log/useSavedMeals.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'

/** Where the add button leads on phones and tablets: the log sheet on a screen of its own. */
export function LogFoodScreen() {
  useDocumentTitle('Add food')
  const savedMeals = useSavedMeals()
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col">
      <LogSheet savedMeals={savedMeals} />
    </div>
  )
}
