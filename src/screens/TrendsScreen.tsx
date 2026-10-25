import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { useAuth } from '../auth/context.ts'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { formatDayHeading, parseDateKey } from '../lib/dates.ts'
import { toProfile } from '../lib/firstRun.ts'
import { formatNumber } from '../lib/foodDisplay.ts'
import { dailyTargets } from '../lib/targets.ts'
import {
  describeRange,
  fetchDailyTotals,
  formatRange,
  isCurrent,
  rangeFor,
  shiftRange,
  summarizeRange,
  type DateRange,
  type DayBar,
  type DayTotal,
  type Period,
  type RangeSummary,
} from '../lib/trends.ts'
import { useProfile } from '../profile/context.ts'
import { trendsDayPath } from '../shell/nav.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'

const CARD = 'flex flex-col gap-4 rounded-2xl border border-koshur-border bg-koshur-surface p-5 lg:p-6'
const ICON_BUTTON =
  'inline-flex size-11 items-center justify-center rounded-xl border border-koshur-border text-koshur-silk transition-colors hover:border-deficit-ring hover:text-deficit-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring disabled:opacity-60 disabled:hover:border-koshur-border disabled:hover:text-koshur-silk'

const MACRO_LABELS = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' } as const
const MACRO_BARS = { protein: 'bg-macro-protein', carbs: 'bg-macro-carb', fat: 'bg-macro-fat' } as const

/** The highest bar is the target or the biggest day, with a little room above it. */
function chartTop(days: readonly DayBar[], target: number | null): number {
  return Math.max(target ?? 0, ...days.map((d) => d.kcal), 1) * 1.08
}

function barLabel(day: DayBar, target: number | null): string {
  const when = formatDayHeading(parseDateKey(day.date))
  if (day.state === 'empty') return `${when}: nothing logged. Open the day`
  const standing = target ? (day.over ? ', over target' : ', under target') : ''
  return `${when}: ${formatNumber(Math.round(day.kcal))} kcal${standing}. Open the day`
}

/** One bar per day. Logged days open the day; the rest are drawn only. */
function Chart({ summary, target }: { summary: RangeSummary; target: number | null }) {
  const top = chartTop(summary.days, target)
  const gap = summary.days.length > 7 ? 'gap-0.5 sm:gap-1' : 'gap-2 sm:gap-4'
  return (
    <div className="flex flex-col gap-2">
      <div className={`relative flex h-45 items-end pt-2 lg:h-60 ${gap}`}>
        {target && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-koshur-muted"
            style={{ bottom: `${(target / top) * 100}%` }}
          />
        )}
        {summary.days.map((day) => {
          const height = `${Math.max(day.state === 'ahead' ? 0 : 1.5, (day.kcal / top) * 100)}%`
          const color =
            day.state !== 'logged' ? 'bg-koshur-border' : day.over ? 'bg-alert-surplus' : 'bg-deficit-ring'
          return (
            <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              {day.state === 'ahead' ? (
                <span aria-hidden="true" className="block" />
              ) : (
                <Link
                  href={trendsDayPath(day.date)}
                  aria-label={barLabel(day, target)}
                  className={`block rounded-t transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring ${color}`}
                  style={{ height }}
                />
              )}
            </div>
          )
        })}
      </div>
      <div aria-hidden="true" className={`flex ${gap}`}>
        {summary.days.map((day, i) => (
          <span key={day.date} className="min-w-0 flex-1 text-center text-caption text-koshur-muted">
            {summary.days.length > 7 ? (i % 5 === 0 ? day.label : '') : day.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function Counts({ summary }: { summary: RangeSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 border-t border-koshur-border pt-4">
      <p className="m-0 flex flex-col gap-0.5">
        <span className="text-caption text-koshur-muted">Days over target</span>
        <span
          className={`text-heading font-semibold ${summary.over > 0 ? 'text-alert-surplus' : 'text-koshur-silk'}`}
        >
          {summary.over} of {summary.logged}
        </span>
      </p>
      <p className="m-0 flex flex-col gap-0.5">
        <span className="text-caption text-koshur-muted">Days logged</span>
        <span className="text-heading font-semibold">
          {summary.logged} of {summary.daysSoFar}
        </span>
      </p>
    </div>
  )
}

function Macros({ summary }: { summary: RangeSummary }) {
  return (
    <section aria-labelledby="trends-macros" className={CARD}>
      <h2 id="trends-macros" className="m-0 text-body font-semibold">
        Protein, carbs and fat
      </h2>
      {summary.macros.length === 0 ? (
        <p className="m-0 text-body-sm text-koshur-muted">
          {summary.logged === 0
            ? 'Nothing logged on these days.'
            : 'Set a daily target to see each macro against it.'}
        </p>
      ) : (
        <>
          <p className="m-0 text-body-sm text-koshur-muted">
            A day's average against its target, over the days you logged.
          </p>
          {summary.macros.map((m) => (
            <div key={m.key} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3 text-body-sm">
                <span className="text-koshur-muted">{MACRO_LABELS[m.key]}</span>
                <span>
                  <span className="font-semibold">{formatNumber(Math.round(m.average))}</span>
                  <span className="text-koshur-muted"> / {formatNumber(m.target)} g</span>
                </span>
              </div>
              <span aria-hidden="true" className="block h-1.5 rounded-full bg-koshur-border">
                <span
                  className={`block h-1.5 rounded-full ${MACRO_BARS[m.key]}`}
                  style={{ width: `${Math.min(100, (m.average / m.target) * 100)}%` }}
                />
              </span>
            </div>
          ))}
        </>
      )}
    </section>
  )
}

/** The week or month: calories a day against the target, each macro's average, and a short note. */
export function TrendsScreen() {
  useDocumentTitle('Trends')
  const { client } = useAuth()
  const { answers } = useProfile()
  const [today] = useState(() => new Date())
  const [range, setRange] = useState<DateRange>(() => rangeFor('week', today))
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; totals?: DayTotal[]; error?: string } | null>(null)
  const key = `${range.start}:${range.end}:${attempt}`

  const profile = answers && toProfile(answers)
  const targets = profile ? dailyTargets(profile) : null

  useEffect(() => {
    let active = true
    fetchDailyTotals(client, range).then(
      (totals) => {
        if (active) setResult({ key, totals })
      },
      (failure: unknown) => {
        if (active)
          setResult({
            key,
            error: failure instanceof Error ? failure.message : "We couldn't load your trends.",
          })
      },
    )
    return () => {
      active = false
    }
  }, [client, range, key])

  const current = result?.key === key ? result : null
  const totals = current?.totals ?? null
  const error = current?.error ?? null

  function choose(period: Period) {
    if (period !== range.period) setRange(rangeFor(period, today))
  }

  const summary = totals ? summarizeRange(range, totals, targets, today) : null
  const note = summary ? describeRange(range, summary, targets?.kcal ?? null, today) : null

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <h1 tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none">
          Trends
        </h1>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <fieldset className="m-0 grid grid-cols-2 rounded-xl border border-koshur-border bg-koshur-surface p-1 sm:w-50">
            <legend className="sr-only">Period</legend>
            {(['week', 'month'] as const).map((period) => {
              const pressed = period === range.period
              return (
                <button
                  key={period}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => choose(period)}
                  className={`min-h-11 rounded-lg text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring sm:min-h-9 ${
                    pressed
                      ? 'bg-deficit-ring font-semibold text-koshur-surface dark:text-koshur-base'
                      : 'font-medium text-koshur-muted hover:text-koshur-silk'
                  }`}
                >
                  {period === 'week' ? 'Week' : 'Month'}
                </button>
              )
            })}
          </fieldset>
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <button
              type="button"
              aria-label={range.period === 'week' ? 'Earlier week' : 'Earlier month'}
              onClick={() => setRange(shiftRange(range, -1))}
              className={ICON_BUTTON}
            >
              <ChevronLeft aria-hidden="true" size={20} strokeWidth={2} />
            </button>
            <p className="m-0 min-w-0 text-center text-body font-semibold sm:min-w-40 lg:text-body-sm">
              {formatRange(range)}
            </p>
            <button
              type="button"
              aria-label={range.period === 'week' ? 'Later week' : 'Later month'}
              onClick={() => setRange(shiftRange(range, 1))}
              disabled={isCurrent(range, today)}
              className={ICON_BUTTON}
            >
              <ChevronRight aria-hidden="true" size={20} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className={`${CARD} items-start`}>
          <Alert>{error}</Alert>
          <Button variant="secondary" size="small" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : !summary || !note ? (
        <>
          <output className="sr-only">Loading your trends</output>
          <div aria-hidden="true" className={`h-80 ${CARD}`} />
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <section aria-labelledby="trends-calories" className={`${CARD} lg:col-span-2`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="trends-calories" className="m-0 text-body font-semibold">
                Calories
              </h2>
              {targets && (
                <p className="m-0 text-body-sm text-koshur-muted">Target {formatNumber(targets.kcal)} kcal</p>
              )}
            </div>
            <p className="m-0 flex items-baseline gap-1.5">
              {summary.averageKcal === null ? (
                <span className="text-body text-koshur-muted">Nothing logged on these days.</span>
              ) : (
                <>
                  <span className="text-display font-semibold text-koshur-silk">
                    {formatNumber(Math.round(summary.averageKcal))}
                  </span>
                  <span className="text-body-sm text-koshur-muted">kcal a day on average</span>
                </>
              )}
            </p>
            <Chart summary={summary} target={targets?.kcal ?? null} />
            <Counts summary={summary} />
          </section>
          <div className="flex flex-col gap-6">
            <Macros summary={summary} />
            <section aria-labelledby="trends-note" className={`${CARD} gap-2`}>
              <h2 id="trends-note" className="m-0 text-body font-semibold">
                {note.title}
              </h2>
              <p className="m-0 text-body-sm text-koshur-muted">{note.text}</p>
            </section>
          </div>
        </div>
      )}
    </>
  )
}
