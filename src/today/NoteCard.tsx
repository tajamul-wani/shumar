import { ChevronRight, Quote } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link } from 'wouter'
import { useAuth } from '../auth/context.ts'
import { addDays, localDateKey } from '../lib/dates.ts'
import { noteForDay, weekLines } from '../lib/notes.ts'
import { fetchDailyTotals, summarizeRange, type DateRange, type DayTotal } from '../lib/trends.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

interface NoteCardProps {
  date: Date
  /** The daily calorie target, for how yesterday went against it. */
  targetKcal: number | null
  /** Rises whenever today's logs change, so the week's count follows. */
  version?: number
}

/**
 * Beside the ring on wide screens: a note for the day in Shumār's own voice, then what the last
 * seven days say (days logged, how yesterday went) and a link to the week. Phones go without it.
 */
export function NoteCard({ date, targetKcal, version = 0 }: NoteCardProps) {
  const { client } = useAuth()
  const headingId = useId()
  const start = localDateKey(addDays(date, -6))
  const end = localDateKey(date)
  const range: DateRange = { period: 'week', start, end }
  const requestKey = `${start}:${end}:${version}`
  const [result, setResult] = useState<{ key: string; totals: DayTotal[] } | null>(null)

  useEffect(() => {
    let active = true
    fetchDailyTotals(client, { period: 'week', start, end }).then(
      (totals) => {
        if (active) setResult({ key: `${start}:${end}:${version}`, totals })
      },
      // The week is an extra here: without it the card still has its note.
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [client, start, end, version])

  const totals = result?.key === requestKey ? result.totals : null
  const summary = totals ? summarizeRange(range, totals, null, date) : null
  const yesterdayKey = localDateKey(addDays(date, -1))
  const yesterday = totals?.find((total) => total.date === yesterdayKey) ?? null
  const lines = summary ? weekLines(summary.logged, summary.daysSoFar, yesterday, targetKcal) : null

  return (
    <section
      aria-labelledby={headingId}
      className="hidden h-full flex-col gap-3 rounded-2xl border border-koshur-border bg-koshur-surface p-6 lg:flex"
    >
      <h2
        id={headingId}
        className="m-0 flex items-center gap-2 text-caption font-semibold tracking-wide text-koshur-muted uppercase"
      >
        <Quote aria-hidden="true" size={20} strokeWidth={2} className="size-4 text-deficit-ring" />A note for
        today
      </h2>
      <p className="m-0 text-title font-semibold text-koshur-silk">{noteForDay(date)}</p>
      {lines && (
        <div className="mt-auto flex flex-col gap-2 border-t border-koshur-border pt-4">
          {lines.map((line) => (
            <p key={line} className="m-0 text-body-sm text-koshur-muted">
              {line}
            </p>
          ))}
          <Link
            href="/trends"
            className={`inline-flex min-h-9 items-center gap-1 self-start rounded-lg text-body-sm font-semibold text-deficit-ring transition-opacity hover:opacity-80 ${FOCUS_RING}`}
          >
            See your week
            <ChevronRight aria-hidden="true" size={20} strokeWidth={2} className="size-4" />
          </Link>
        </div>
      )}
    </section>
  )
}
