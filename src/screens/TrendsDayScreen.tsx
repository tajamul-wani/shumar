import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Redirect } from 'wouter'
import { useAuth } from '../auth/context.ts'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { fetchDayLogs, type LoggedFood } from '../lib/dayLogs.ts'
import { formatDayHeading, localDateKey, parseDateKey } from '../lib/dates.ts'
import { toProfile } from '../lib/firstRun.ts'
import { formatNumber } from '../lib/foodDisplay.ts'
import { roundForDisplay, sumNutrients } from '../lib/nutrition.ts'
import { dailyTargets } from '../lib/targets.ts'
import { SODIUM_LIMIT_MG, sodiumAlert, summarizeDay } from '../lib/today.ts'
import { useProfile } from '../profile/context.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'
import { CaloriesCard } from '../today/CaloriesCard.tsx'
import { MealList } from '../today/MealList.tsx'

const CARD = 'flex flex-col gap-3 rounded-2xl border border-koshur-border bg-koshur-surface p-5 lg:p-6'
const MACROS = [
  ['protein', 'Protein'],
  ['carbs', 'Carbs'],
  ['fat', 'Fat'],
] as const

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** A past day opened from the Trends chart: what went over, what fell short, sodium, and the meals as logged. */
export function TrendsDayScreen({ date }: { date: string }) {
  const valid = DATE_KEY.test(date) && localDateKey(parseDateKey(date)) === date
  const heading = valid ? formatDayHeading(parseDateKey(date)) : 'Trends'
  useDocumentTitle(heading)
  const { client } = useAuth()
  const { answers } = useProfile()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; logs?: LoggedFood[]; error?: string } | null>(null)
  const requestKey = `${date}:${attempt}`

  useEffect(() => {
    if (!valid) return
    let active = true
    fetchDayLogs(client, date).then(
      (logs) => {
        if (active) setResult({ key: requestKey, logs })
      },
      (failure: unknown) => {
        if (active)
          setResult({
            key: requestKey,
            error: failure instanceof Error ? failure.message : "We couldn't load this day.",
          })
      },
    )
    return () => {
      active = false
    }
  }, [client, date, valid, requestKey])

  const current = result?.key === requestKey ? result : null
  const logs = current?.logs ?? null
  const error = current?.error ?? null

  if (!valid) return <Redirect to="/trends" replace />

  const profile = answers && toProfile(answers)
  const targets = profile ? dailyTargets(profile) : null
  const day = logs ? summarizeDay(logs) : null
  const sodium = logs ? sumNutrients(logs.map((log) => log.nutrients)).sodiumMg : 0
  const alert = logs ? sodiumAlert(logs) : null
  const shown = day ? roundForDisplay(day.totals) : null

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          href="/trends"
          className="inline-flex min-h-11 items-center gap-1 self-start text-body-sm font-semibold text-koshur-silk transition-colors hover:text-deficit-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring"
        >
          <ChevronLeft aria-hidden="true" size={20} strokeWidth={2} />
          Trends
        </Link>
        <h1 tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none">
          {heading}
        </h1>
        {targets && (
          <p className="m-0 text-body-sm text-koshur-muted">
            Against the target you have now: {formatNumber(targets.kcal)} kcal a day.
          </p>
        )}
      </div>

      {error ? (
        <div className={`${CARD} items-start`}>
          <Alert>{error}</Alert>
          <Button variant="secondary" size="small" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : !logs || !day || !shown ? (
        <>
          <output className="sr-only">Loading the day</output>
          <div aria-hidden="true" className={`h-60 ${CARD}`} />
        </>
      ) : logs.length === 0 ? (
        <p className="m-0 text-body text-koshur-muted">Nothing was logged on this day.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col gap-6">
            <CaloriesCard totals={day.totals} target={targets?.kcal} macroTargets={targets} />
            {targets && (
              <section aria-labelledby="day-macros" className={CARD}>
                <h2 id="day-macros" className="m-0 text-body font-semibold">
                  Against the targets
                </h2>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-body-sm">
                  {MACROS.map(([key, label]) => {
                    const gap = shown[key] - targets[key]
                    const over = gap > 0
                    return (
                      <li key={key} className="flex justify-between gap-3">
                        <span className="text-koshur-muted">{label}</span>
                        <span className={over ? 'font-semibold' : ''}>
                          {gap === 0
                            ? 'Right on target'
                            : `${formatNumber(Math.abs(Math.round(gap * 10) / 10))} g ${over ? 'over' : 'short'}`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            <section aria-labelledby="day-sodium" className={`${CARD} gap-2`}>
              <div className="flex justify-between gap-3 text-body-sm">
                <h2 id="day-sodium" className="m-0 font-semibold">
                  Sodium
                </h2>
                <span>
                  <span className="font-semibold">{formatNumber(Math.round(sodium))}</span>
                  <span className="text-koshur-muted"> / {formatNumber(SODIUM_LIMIT_MG)} mg</span>
                </span>
              </div>
              <span aria-hidden="true" className="block h-1.5 rounded-full bg-koshur-border">
                <span
                  className={`block h-1.5 rounded-full ${alert ? 'bg-alert-surplus' : 'bg-deficit-ring'}`}
                  style={{ width: `${Math.min(100, (sodium / SODIUM_LIMIT_MG) * 100)}%` }}
                />
              </span>
              <p className="m-0 text-caption text-koshur-muted">
                {alert
                  ? `Over the day's limit. Most of it came from ${alert.mostFrom}.`
                  : "Under the day's limit of 2,000 mg."}
              </p>
            </section>
          </div>
          <div className="flex flex-col gap-3">
            <MealList groups={day.meals} showTimes />
            <p className="m-0 text-caption text-koshur-muted">Values as they were logged.</p>
          </div>
        </div>
      )}
    </>
  )
}
