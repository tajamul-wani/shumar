import { CalendarCheck, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/context.ts'
import { AddButton } from '../components/AddButton.tsx'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { InstallCard } from '../components/InstallCard.tsx'
import { Logo } from '../components/Logo.tsx'
import { Toast, type ToastMessage } from '../components/Toast.tsx'
import { parseLoggedFood, restoreLog, type LoggedFood } from '../lib/dayLogs.ts'
import { formatDayHeading, localDateKey } from '../lib/dates.ts'
import { formatNumber } from '../lib/foodDisplay.ts'
import { LogError } from '../lib/logs.ts'
import { defaultMeal, mealPhrase, type Meal } from '../lib/meals.ts'
import { toProfile } from '../lib/firstRun.ts'
import { dailyTargets } from '../lib/targets.ts'
import { furthestBehind, sodiumAlert, summarizeDay } from '../lib/today.ts'
import { useProfile } from '../profile/context.ts'
import { SetTargetPrompt } from '../firstRun/SetTargetCard.tsx'
import { AddFoodDialog } from '../log/AddFoodDialog.tsx'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'
import { HeroCard } from '../today/HeroCard.tsx'
import { MealCards } from '../today/MealCards.tsx'
import { NoteCard } from '../today/NoteCard.tsx'
import { useDayLogs } from '../today/useDayLogs.ts'

const CARD = 'rounded-2xl border border-koshur-border bg-koshur-surface'

const byTime = (a: LoggedFood, b: LoggedFood) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt)

function messageFrom(failure: unknown, fallback: string): string {
  return failure instanceof LogError ? failure.message : fallback
}

const mealName = (food: LoggedFood) => mealPhrase(food.meal)

/** A food just removed on its edit page, which comes back here with it so Today can offer Undo. */
function removedOnArrival(): LoggedFood | null {
  const state = history.state as { removedLog?: unknown } | null
  return state?.removedLog ? parseLoggedFood(state.removedLog) : null
}

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

/** The empty day, with the way to add the first food. */
function NoMeals({ onAdd }: { onAdd: () => void }) {
  return (
    <section aria-label="Meals" className={`flex flex-col items-start gap-3 p-5 ${CARD}`}>
      <p className="m-0 text-body text-koshur-muted">No meals yet today.</p>
      <Button size="small" onClick={onAdd}>
        Add food
      </Button>
    </section>
  )
}

/** The day at a glance, from the V2 design: calories, macros, alerts and meals. */
export function TodayScreen() {
  useDocumentTitle('Today')
  // Read once when the screen opens, so re-renders never change the date mid-view.
  const [today] = useState(() => new Date())
  const { client } = useAuth()
  const { logs, error, daysLogged, reload, update, refreshDays } = useDayLogs(localDateKey(today))
  // The meal the Add food popup is open on, or null while it is closed.
  const [adding, setAdding] = useState<Meal | null>(null)
  const openAddFood = (meal?: Meal) => setAdding(meal ?? defaultMeal(new Date()))
  const profile = useProfile()
  const answered = profile.answers && toProfile(profile.answers)
  const targets = answered ? dailyTargets(answered) : null
  // Read once as the screen opens: a food removed on its edit page, to say so and offer Undo.
  const [arrived] = useState(removedOnArrival)
  // The food just removed, kept so Undo can put it back exactly as it was.
  const [removed, setRemoved] = useState<LoggedFood | null>(arrived)
  const [restoring, setRestoring] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(
    arrived && {
      id: 1,
      text: 'Removed',
      tone: 'removed',
      detail: `${arrived.foodName} from ${mealName(arrived)}`,
    },
  )
  const toastId = useRef(1)
  const [actionError, setActionError] = useState<string | null>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  const mealsHeadingRef = useRef<HTMLHeadingElement>(null)

  function showToast(text: string, tone: ToastMessage['tone'], detail: string) {
    toastId.current += 1
    setToast({ id: toastId.current, text, tone, detail })
  }

  useEffect(() => {
    if (!arrived) return
    // Forgotten at once, so a reload or going back and forward never offers it again.
    history.replaceState(null, '')
    // Focus goes to Undo, so a keyboard can reverse it at once. The shell puts focus on the new
    // screen's heading after this runs, so Undo takes it a frame later.
    requestAnimationFrame(() => undoRef.current?.focus())
  }, [arrived])

  async function undo() {
    if (!removed || restoring) return
    setActionError(null)
    setRestoring(true)
    try {
      const restored = await restoreLog(client, removed)
      // Tapped before the day had loaded, the food may be missing from what loads, so load it again.
      if (logs) update((current) => [...current, restored].sort(byTime))
      else reload()
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

  // Two slots: the day at a glance (or its loading or error state), and the meals.
  let day: ReactNode
  let mealList: ReactNode = null
  if (logs) {
    const { totals, meals } = summarizeDay(logs)
    const alert = sodiumAlert(logs)
    const macroTargets = targets && { protein: targets.protein, carbs: targets.carbs, fat: targets.fat }
    // The review needs a target and something eaten, or a sodium alert.
    const reviewing = !!targets && logs.length > 0
    // What stands beside the ring while there is no review: setting a target, or why it could not load.
    let standIn: ReactNode = null
    if (profile.status === 'error') {
      standIn = (
        <>
          <Alert>{profile.error}</Alert>
          <Button variant="secondary" size="small" onClick={profile.reload}>
            Try again
          </Button>
        </>
      )
    } else if (profile.status === 'ready' && !targets) {
      standIn = (
        <section aria-labelledby="set-target-heading" className="flex flex-col items-start gap-3">
          <h2 id="set-target-heading" className="m-0 text-body font-semibold">
            Set your daily target
          </h2>
          <SetTargetPrompt />
        </section>
      )
    }
    day = (
      <HeroCard
        now={today}
        totals={totals}
        target={targets?.kcal}
        macroTargets={macroTargets}
        reviewing={reviewing}
        behind={reviewing && macroTargets ? furthestBehind(totals, macroTargets) : null}
        alert={alert}
      >
        {standIn}
      </HeroCard>
    )
    mealList = (
      <>
        {actionError && <Alert>{actionError}</Alert>}
        {meals.length > 0 ? (
          <MealCards
            groups={meals}
            dayKcal={totals.kcal}
            showTimes
            editable
            onAdd={openAddFood}
            headingRef={mealsHeadingRef}
          />
        ) : (
          <NoMeals onAdd={() => openAddFood()} />
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
          <p className="m-0 text-body text-balance! text-koshur-muted lg:text-body-sm">
            {formatDayHeading(today)}
          </p>
          <h1
            tabIndex={-1}
            className="sr-only m-0 text-heading font-semibold focus:outline-none lg:not-sr-only"
          >
            Today
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {daysLogged ? <DaysLogged count={daysLogged} /> : null}
          {/* On phones and tablets the round plus above the tab bar opens the same popup. */}
          <div className="hidden lg:block">
            <Button size="small" onClick={() => openAddFood()}>
              <Plus aria-hidden="true" size={20} strokeWidth={2.5} className="size-4" />
              Add food
            </Button>
          </div>
        </div>
      </header>
      {/* The day at a glance (with a note for the day beside it on wide screens), then the meals as
          cards: one column on phones, two across from 1024 px up. */}
      <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
        {/* On phones and tablets, the offer to install the app, until it is installed or set aside. */}
        <InstallCard place="today" className="lg:hidden" />
        <div className="grid min-w-0 gap-4 lg:grid-cols-12 lg:items-stretch lg:gap-6">
          <div className="min-w-0 lg:col-span-8">{day}</div>
          <div className="min-w-0 lg:col-span-4">
            <NoteCard date={today} targetKcal={targets?.kcal ?? null} version={logs?.length ?? 0} />
          </div>
        </div>
        {mealList && <div className="flex min-w-0 flex-col gap-4">{mealList}</div>}
      </div>
      {logs && <AddButton label="Add food" onClick={() => openAddFood()} />}
      <AddFoodDialog
        meal={adding}
        logs={logs ?? []}
        onChangeMeal={setAdding}
        onAdded={reload}
        onClose={() => setAdding(null)}
      />
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
