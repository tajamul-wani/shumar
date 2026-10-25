import { Moon, Sun, TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { formatNumber } from '../lib/foodDisplay.ts'
import { reviewTitle, type MacroBehind, type RingState, type SodiumAlert } from '../lib/today.ts'

const BEHIND = {
  protein: 'Protein is furthest behind',
  carbs: 'Carbs are furthest behind',
  fat: 'Fat is furthest behind',
} as const

/** How the day's calories stand against the target, as the V2 design words it. */
function calorieLine(ring: RingState | null): string | null {
  if (ring?.kind === 'left') return `A steady day. You have ${formatNumber(ring.left)} kcal left.`
  if (ring?.kind === 'over') {
    return `You went ${formatNumber(ring.over)} kcal over today. One day does not undo a good week.`
  }
  return null
}

interface ReviewCardProps {
  now: Date
  /** The day's calories against the daily target, when there is one. */
  ring: RingState | null
  behind: MacroBehind | null
  alert: SodiumAlert | null
  /** The day's sodium so far. Shown on wide screens even when it is under the limit. */
  sodiumMg?: number
}

/** The review card from the V2 design: calories left or over, the macro furthest behind, and sodium. */
export function ReviewCard({ now, ring, behind, alert, sodiumMg }: ReviewCardProps) {
  const headingId = useId()
  const { title, evening } = reviewTitle(now)
  const Icon = evening ? Moon : Sun
  const line = calorieLine(ring)
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3.5 rounded-2xl border border-koshur-border bg-koshur-surface p-5 lg:px-6"
    >
      <h2
        id={headingId}
        className="m-0 flex items-center gap-2 text-caption font-semibold tracking-wide text-koshur-muted uppercase"
      >
        <Icon aria-hidden="true" size={20} strokeWidth={2} className="size-4 sm:size-5 text-deficit-ring" />
        {title}
      </h2>
      {line && <p className="m-0 text-body text-koshur-silk">{line}</p>}
      {(behind || alert || sodiumMg !== undefined) && (
        <div
          className={`flex-col gap-2.5 ${behind || alert ? 'flex' : 'hidden lg:flex'} ${line ? 'border-t border-koshur-border pt-3.5' : ''}`}
        >
          {behind && (
            <p className="m-0 flex items-start justify-between gap-3 text-body-sm">
              <span className="text-koshur-muted">{BEHIND[behind.key]}</span>
              <span className="shrink-0 font-semibold text-koshur-silk">
                {formatNumber(Math.round(behind.eaten))} of {formatNumber(behind.target)} g
              </span>
            </p>
          )}
          {alert && (
            <p className="m-0 flex items-start justify-between gap-3 text-body-sm">
              <span className="flex min-w-0 items-start gap-2 text-koshur-muted">
                <TriangleAlert
                  aria-hidden="true"
                  size={20}
                  strokeWidth={2}
                  className="mt-0.5 size-4 sm:size-5 shrink-0 text-alert-surplus sm:mt-0"
                />
                Sodium is high, mostly from {alert.mostFrom}
              </span>
              <span className="shrink-0 font-semibold text-koshur-silk">
                {formatNumber(Math.round(alert.totalMg))} mg
              </span>
            </p>
          )}
          {!alert && sodiumMg !== undefined && (
            <p className="m-0 hidden items-start justify-between gap-3 text-body-sm lg:flex">
              <span className="text-koshur-muted">Sodium so far</span>
              <span className="shrink-0 font-semibold text-koshur-silk">
                {formatNumber(Math.round(sodiumMg))} mg
              </span>
            </p>
          )}
        </div>
      )}
    </section>
  )
}
