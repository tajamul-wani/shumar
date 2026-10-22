import { Moon, Sun, TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { formatNumber } from '../lib/foodDisplay.ts'
import { reviewTitle, type SodiumAlert } from '../lib/today.ts'

/**
 * The review card from the V2 design. For now it holds the sodium alert; the lines that need a
 * daily target (calories left, the macro furthest behind) arrive with targets.
 */
export function ReviewCard({ alert, now }: { alert: SodiumAlert; now: Date }) {
  const headingId = useId()
  const { title, evening } = reviewTitle(now)
  const Icon = evening ? Moon : Sun
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3.5 rounded-2xl border border-koshur-border bg-koshur-surface p-5 lg:px-6"
    >
      <h2
        id={headingId}
        className="m-0 flex items-center gap-2 text-caption font-semibold tracking-wide text-koshur-muted uppercase"
      >
        <Icon aria-hidden="true" size={20} strokeWidth={2} className="text-deficit-ring" />
        {title}
      </h2>
      <p className="m-0 flex items-start justify-between gap-3 text-body-sm">
        <span className="flex min-w-0 items-start gap-2 text-koshur-muted">
          <TriangleAlert
            aria-hidden="true"
            size={20}
            strokeWidth={2}
            className="shrink-0 text-alert-surplus"
          />
          Sodium is high, mostly from {alert.mostFrom}
        </span>
        <span className="shrink-0 font-semibold text-koshur-silk">
          {formatNumber(Math.round(alert.totalMg))} mg
        </span>
      </p>
    </section>
  )
}
