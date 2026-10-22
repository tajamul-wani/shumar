import { CalendarCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'wouter'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { buttonClass } from '../components/buttonStyles.ts'
import { formatDayHeading, localDateKey } from '../lib/dates.ts'
import { formatNumber } from '../lib/foodDisplay.ts'
import { sodiumAlert, summarizeDay } from '../lib/today.ts'
import { LOG_FOOD_PATH } from '../shell/nav.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'
import { CaloriesCard } from '../today/CaloriesCard.tsx'
import { MealList } from '../today/MealList.tsx'
import { ReviewCard } from '../today/ReviewCard.tsx'
import { useDayLogs } from '../today/useDayLogs.ts'

const CARD = 'rounded-2xl border border-koshur-border bg-koshur-surface'

function DaysLogged({ count }: { count: number }) {
  return (
    <p className="m-0 flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-koshur-border bg-koshur-surface px-3.5 text-body-sm font-semibold text-koshur-silk">
      <CalendarCheck aria-hidden="true" size={20} strokeWidth={2} className="text-deficit-ring" />
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

function NoMeals() {
  return (
    <section aria-label="Meals" className={`flex flex-col items-start gap-3 p-5 ${CARD}`}>
      <p className="m-0 text-body text-koshur-muted">No meals yet today.</p>
      <Link href={LOG_FOOD_PATH} className={buttonClass('primary', 'small')}>
        Add food
      </Link>
    </section>
  )
}

/** The day at a glance, from the V2 design: calories, macros, alerts and meals. */
export function TodayScreen() {
  useDocumentTitle('Today')
  // Read once when the screen opens, so re-renders never change the date mid-view.
  const [today] = useState(() => new Date())
  const { logs, error, daysLogged, reload } = useDayLogs(localDateKey(today))

  let content
  if (logs) {
    const { totals, meals } = summarizeDay(logs)
    const alert = sodiumAlert(logs)
    content = (
      <>
        {alert && <ReviewCard alert={alert} now={today} />}
        <CaloriesCard totals={totals} />
        {meals.length > 0 ? <MealList groups={meals} /> : <NoMeals />}
      </>
    )
  } else if (error) {
    content = (
      <div className="flex flex-col items-start gap-3">
        <Alert>{error}</Alert>
        <Button variant="secondary" size="small" onClick={reload}>
          Try again
        </Button>
      </div>
    )
  } else {
    content = <Loading />
  }

  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span
            lang="ks"
            aria-hidden="true"
            className="font-wordmark text-heading text-deficit-ring lg:hidden"
          >
            شُمار
          </span>
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
      <div className="flex min-w-0 flex-col gap-4">{content}</div>
    </>
  )
}
