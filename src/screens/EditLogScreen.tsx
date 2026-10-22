import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { useAuth } from '../auth/context.ts'
import { Alert } from '../components/Alert.tsx'
import { changeLog, fetchLog, foodFromLog, type LoggedFood } from '../lib/dayLogs.ts'
import type { FoodUnit } from '../lib/foodSearch.ts'
import { LogError } from '../lib/logs.ts'
import type { Meal } from '../lib/meals.ts'
import { FoodDetail } from '../log/FoodDetail.tsx'
import { MealPicker } from '../log/LogSheet.tsx'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'

const LINK =
  'self-start rounded-sm text-body text-koshur-silk underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

type Loaded =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; log: LoggedFood }

function messageFrom(failure: unknown, fallback: string): string {
  return failure instanceof LogError ? failure.message : fallback
}

/** The logged food in the log sheet's food view, with its meal, saved with "Save changes". */
function ChangeLog({ log }: { log: LoggedFood }) {
  const { client } = useAuth()
  const [, navigate] = useLocation()
  const [meal, setMeal] = useState<Meal>(log.meal)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const mealId = useId()
  const { food, unit, quantity } = useMemo(() => foodFromLog(log), [log])

  async function save(nextUnit: FoodUnit, nextQuantity: number) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      await changeLog(client, log, { meal, unit: nextUnit, quantity: nextQuantity })
      navigate('/')
    } catch (failure) {
      setError(messageFrom(failure, "We couldn't save your changes. Check your connection and try again."))
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <FoodDetail
      food={food}
      initialUnit={unit}
      initialQuantity={quantity}
      actionLabel="Save changes"
      busyLabel="Saving"
      backLabel="Back to Today"
      saving={saving}
      error={error}
      onBack={() => navigate('/')}
      onSubmit={save}
    >
      <MealPicker id={mealId} meal={meal} onChoose={setMeal} />
    </FoodDetail>
  )
}

function Title() {
  return (
    <h1 tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none">
      Edit food
    </h1>
  )
}

/** Changing the amount, unit or meal of a food already logged. Opened from the Today screen. */
export function EditLogScreen({ id }: { id: string }) {
  useDocumentTitle('Edit food')
  const { client } = useAuth()
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })

  useEffect(() => {
    let active = true
    fetchLog(client, id).then(
      (log) => {
        if (active) setLoaded(log ? { status: 'ready', log } : { status: 'missing' })
      },
      (failure: unknown) => {
        if (active) {
          setLoaded({
            status: 'failed',
            message: messageFrom(failure, "We couldn't load this food. Check your connection and try again."),
          })
        }
      },
    )
    return () => {
      active = false
    }
  }, [client, id])

  // Once the food has loaded, its heading replaces the one focused on arrival, so focus moves to it.
  useEffect(() => {
    if (loaded.status !== 'loading') document.querySelector<HTMLElement>('#main h1')?.focus()
  }, [loaded.status])

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      {loaded.status === 'ready' && <ChangeLog log={loaded.log} />}
      {loaded.status === 'loading' && (
        <>
          <Title />
          <output className="sr-only">Loading</output>
          <div aria-hidden="true" className="flex flex-col gap-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-14 rounded-xl border border-koshur-border bg-koshur-surface" />
            ))}
          </div>
        </>
      )}
      {loaded.status === 'missing' && (
        <>
          <Title />
          <p className="m-0 text-body text-koshur-muted">
            We couldn't find this food. It may have been removed.
          </p>
          <Link href="/" className={LINK}>
            Back to Today
          </Link>
        </>
      )}
      {loaded.status === 'failed' && (
        <>
          <Title />
          <Alert>{loaded.message}</Alert>
          <Link href="/" className={LINK}>
            Back to Today
          </Link>
        </>
      )}
    </div>
  )
}
