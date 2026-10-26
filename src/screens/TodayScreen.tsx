import { CalendarCheck } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { useAuth } from '../auth/context.ts'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { Logo } from '../components/Logo.tsx'
import { Toast, type ToastMessage } from '../components/Toast.tsx'
import { buttonClass } from '../components/buttonStyles.ts'
import { removeLog, restoreLog, type LoggedFood } from '../lib/dayLogs.ts'
import { formatDayHeading, localDateKey } from '../lib/dates.ts'
import { formatNumber } from '../lib/foodDisplay.ts'
import { LogError } from '../lib/logs.ts'
import { mealPhrase } from '../lib/meals.ts'
import { toProfile } from '../lib/firstRun.ts'
import { dailyTargets } from '../lib/targets.ts'
import { sumNutrients } from '../lib/nutrition.ts'
import { furthestBehind, ringState, sodiumAlert, summarizeDay } from '../lib/today.ts'
import { useProfile } from '../profile/context.ts'
import { SetTargetCard } from '../firstRun/SetTargetCard.tsx'
import { LOG_FOOD_PATH } from '../shell/nav.ts'
import { LogSheet } from '../log/LogSheet.tsx'
import { DESKTOP_QUERY, useMediaQuery } from '../shell/useMediaQuery.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'
import { CaloriesCard } from '../today/CaloriesCard.tsx'
import { MealList } from '../today/MealList.tsx'
import { ReviewCard } from '../today/ReviewCard.tsx'
import { useDayLogs } from '../today/useDayLogs.ts'

const CARD = 'rounded-2xl border border-koshur-border bg-koshur-surface'

const byTime = (a: LoggedFood, b: LoggedFood) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt)

function messageFrom(failure: unknown, fallback: string): string {
  return failure instanceof LogError ? failure.message : fallback
}

const mealName = (food: LoggedFood) => mealPhrase(food.meal)

function DaysLogged({ count }: { count: number }) {
  return (
    <p className="m-0 flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-koshur-border bg-koshur-surface px-3.5 text-body-sm font-semibold text-koshur-silk">
      <CalendarCheck
        aria-hidden="true"
        size={20}
        strokeWidth={2}
        className="size-4 sm:size-5 text-deficit-ring"
      />
      {formatNumber(count)} {count === 1 ? 'day' : 'days'} logged
    </p>
  )
}

function Loading() {
  return (
    <>
      <output className="sr-only">Loading your day</output>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className={`h-80 ${CARD}`} />
        <div className={`h-40 ${CARD}`} />
      </div>
    </>
  )
}

/** On wide screens Add food sits beside the day, so the empty state needs no button of its own. */
function NoMeals({ withButton }: { withButton: boolean }) {
  return (
    <section aria-label="Meals" className={`flex flex-col items-start gap-3 p-5 ${CARD}`}>
      <p className="m-0 text-body text-koshur-muted">No meals yet today.</p>
      {withButton && (
        <Link href={LOG_FOOD_PATH} className={buttonClass('primary', 'small')}>
          Add food
        </Link>
      )}
    </section>
  )
}

/** The day at a glance, from the V2 design: calories, macros, alerts and meals. */
export function TodayScreen() {
  useDocumentTitle('Today')
  // Read once when the screen opens, so re-renders never change the date mid-view.
  const [today] = useState(() => new Date())
  const { client } = useAuth()
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const { logs, error, daysLogged, reload, update, refreshDays } = useDayLogs(localDateKey(today))
  const profile = useProfile()
  const answered = profile.answers && toProfile(profile.answers)
  const targets = answered ? dailyTargets(answered) : null
  // The food just removed, kept so Undo can put it back exactly as it was.
  const [removed, setRemoved] = useState<LoggedFood | null>(null)
  const [removing, setRemoving] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const toastId = useRef(0)
  const [actionError, setActionError] = useState<string | null>(null)
  // Settles true once the last removal is saved, false if it failed. Undo waits for it.
  const pendingRemoval = useRef<Promise<boolean>>(Promise.resolve(true))
  const undoRef = useRef<HTMLButtonElement>(null)
  const mealsHeadingRef = useRef<HTMLHeadingElement>(null)

  function showToast(text: string, tone: ToastMessage['tone'], detail: string) {
    toastId.current += 1
    setToast({ id: toastId.current, text, tone, detail })
  }

  // After a removal, focus goes to Undo, so a keyboard can reverse it at once.
  useEffect(() => {
    if (removed) undoRef.current?.focus()
  }, [removed])

  async function remove(food: LoggedFood) {
    setActionError(null)
    update((current) => current.filter((log) => log.id !== food.id))
    setRemoved(food)
    showToast('Removed', 'removed', `${food.foodName} from ${mealName(food)}`)
    setRemoving(true)
    const saved = removeLog(client, food.id).then(
      () => true,
      (failure: unknown) => {
        update((current) => [...current, food].sort(byTime))
        setRemoved(null)
        setToast(null)
        setActionError(
          messageFrom(failure, "We couldn't remove this food. Check your connection and try again."),
        )
        return false
      },
    )
    pendingRemoval.current = saved
    if (await saved) refreshDays()
    setRemoving(false)
  }

  async function undo() {
    if (!removed || restoring) return
    setActionError(null)
    setRestoring(true)
    // Undo can be tapped before the removal is saved: wait for it, and if it failed the food is already back.
    if (!(await pendingRemoval.current)) {
      setRestoring(false)
      return
    }
    try {
      const restored = await restoreLog(client, removed)
      update((current) => [...current, restored].sort(byTime))
      showToast('Put back', 'added', `${removed.foodName} in ${mealName(removed)}`)
      setRemoved(null)
      refreshDays()
      // The list may only now be back (when the day's only food was undone), so wait for it to draw.
      requestAnimationFrame(() => mealsHeadingRef.current?.focus())
    } catch (failure) {
      setActionError(
        messageFrom(failure, "We couldn't put this food back. Check your connection and try again."),
      )
    } finally {
      setRestoring(false)
    }
  }

  // Three slots: the card beside the calories (the review, or what stands in for it), the
  // calories themselves (or the day's loading or error state), and the meals.
  let side: ReactNode = null
  let day: ReactNode
  let mealList: ReactNode = null
  if (logs) {
    const { totals, meals } = summarizeDay(logs)
    const alert = sodiumAlert(logs)
    const macroTargets = targets && { protein: targets.protein, carbs: targets.carbs, fat: targets.fat }
    // The review needs a target and something eaten, or a sodium alert.
    const reviewing = targets && logs.length > 0
    if (reviewing || alert) {
      side = (
        <ReviewCard
          now={today}
          ring={reviewing ? ringState(totals.kcal, targets.kcal) : null}
          behind={reviewing && macroTargets ? furthestBehind(totals, macroTargets) : null}
          alert={alert}
          sodiumMg={sumNutrients(logs.map((log) => log.nutrients)).sodiumMg}
        />
      )
    } else if (profile.status === 'error') {
      side = (
        <div className="flex flex-col items-start gap-3">
          <Alert>{profile.error}</Alert>
          <Button variant="secondary" size="small" onClick={profile.reload}>
            Try again
          </Button>
        </div>
      )
    } else if (profile.status === 'ready' && !targets) {
      side = <SetTargetCard />
    }
    day = <CaloriesCard totals={totals} target={targets?.kcal} macroTargets={macroTargets} />
    mealList = (
      <>
        {actionError && <Alert>{actionError}</Alert>}
        {meals.length > 0 ? (
          <MealList
            groups={meals}
            showTimes={desktop}
            busy={removing}
            onRemove={remove}
            headingRef={mealsHeadingRef}
          />
        ) : (
          <NoMeals withButton={!desktop} />
        )}
      </>
    )
  } else if (error) {
    day = (
      <div className="flex flex-col items-start gap-3">
        <Alert>{error}</Alert>
        <Button variant="secondary" size="small" onClick={reload}>
          Try again
        </Button>
      </div>
    )
  } else {
    day = <Loading />
  }

  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="mb-4 lg:hidden">
            <Logo decorative className="h-8 w-auto" />
          </div>
          <p className="m-0 text-body text-koshur-muted lg:text-body-sm">{formatDayHeading(today)}</p>
          <h1
            tabIndex={-1}
            className="sr-only m-0 text-heading font-semibold focus:outline-none lg:not-sr-only"
          >
            Today
          </h1>
        </div>
        {daysLogged ? <DaysLogged count={daysLogged} /> : null}
      </header>
      {/* Phones read top to bottom: the review, the calories, the meals. From 1024 px up the page is a
          dashboard: the calories with the review beside them, then the meals beside Add food, which
          stays in view while a long list scrolls. */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-12 lg:items-start lg:gap-6">
        {side && <div className="min-w-0 lg:order-2 lg:col-span-5">{side}</div>}
        <div className={`min-w-0 lg:order-1 ${side ? 'lg:col-span-7' : 'lg:col-span-12'}`}>{day}</div>
        {mealList && <div className="flex min-w-0 flex-col gap-4 lg:order-3 lg:col-span-7">{mealList}</div>}
        {desktop && (
          <div className={`min-w-0 p-6 lg:sticky lg:top-7 lg:order-4 lg:col-span-5 ${CARD}`}>
            <LogSheet embedded onAdded={reload} />
          </div>
        )}
      </div>
      <Toast
        message={toast}
        duration={removed ? 8000 : 5000}
        onDismiss={() => {
          setToast(null)
          setRemoved(null)
        }}
        action={removed && { label: 'Undo', onClick: undo, busy: restoring }}
        actionRef={undoRef}
        besideAddButton
      />
    </>
  )
}
