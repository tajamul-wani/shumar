import { Moon, Sun, TriangleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { formatNumber } from '../lib/foodDisplay.ts'
import { roundForDisplay, type Nutrients } from '../lib/nutrition.ts'
import {
  SODIUM_LIMIT_MG,
  reviewTitle,
  ringState,
  type MacroBehind,
  type RingState,
  type SodiumAlert,
} from '../lib/today.ts'
import { usePrefersReducedMotion } from './motion.ts'
import { Ring } from './Ring.tsx'

const MACROS = [
  { key: 'protein', label: 'Protein', bar: 'bg-macro-protein' },
  { key: 'carbs', label: 'Carbs', bar: 'bg-macro-carb' },
  { key: 'fat', label: 'Fat', bar: 'bg-macro-fat' },
] as const

const BEHIND = {
  protein: 'Protein is furthest behind',
  carbs: 'Carbs are furthest behind',
  fat: 'Fat is furthest behind',
} as const

type MacroTargets = Pick<Nutrients, 'protein' | 'carbs' | 'fat'>

/** How the day's calories stand against the target, as the V2 design words it. */
function calorieLine(ring: RingState): string | null {
  if (ring.kind === 'left') return `A steady day. You have ${formatNumber(ring.left)} kcal left.`
  if (ring.kind === 'over') {
    return `You went ${formatNumber(ring.over)} kcal over today. One day does not undo a good week.`
  }
  return null
}

interface HeroCardProps {
  now: Date
  totals: Nutrients
  /** The daily calorie target, once the person has one. */
  target?: number | null
  macroTargets?: MacroTargets | null
  /** The review shows once there is a target and something eaten. */
  reviewing: boolean
  behind: MacroBehind | null
  alert: SodiumAlert | null
  /** What stands in for the review while there is none: setting a target, or why it could not load. */
  children?: ReactNode
}

/**
 * The day at a glance, from the Today redesign: a large ring that fills as the day loads, the
 * review as a headline beside it, then protein, carbs and fat against their targets and the sodium
 * so far. On phones the ring sits above the text.
 */
export function HeroCard({
  now,
  totals,
  target = null,
  macroTargets = null,
  reviewing,
  behind,
  alert,
  children,
}: HeroCardProps) {
  const reviewId = useId()
  const reduceMotion = usePrefersReducedMotion()
  const state = ringState(totals.kcal, target)
  const shown = roundForDisplay(totals)
  const { title, evening } = reviewTitle(now)
  const Icon = evening ? Moon : Sun
  const line = reviewing ? calorieLine(state) : null
  const sodium = Math.round(totals.sodiumMg)
  return (
    <section
      aria-label="Calories and macros"
      className="flex flex-col items-center gap-6 rounded-2xl border border-koshur-border bg-koshur-surface px-5 pt-6 pb-5 lg:flex-row lg:items-center lg:gap-10 lg:px-8 lg:py-7"
    >
      <Ring state={state} size="large" animate={!reduceMotion} detail />
      <div className="flex w-full min-w-0 flex-col gap-5 lg:flex-1 lg:gap-6">
        {reviewing || alert ? (
          <section aria-labelledby={reviewId} className="flex flex-col gap-2">
            <h2
              id={reviewId}
              className="m-0 flex items-center gap-2 text-caption font-semibold tracking-wide text-koshur-muted uppercase"
            >
              <Icon
                aria-hidden="true"
                size={20}
                strokeWidth={2}
                className="size-4 text-deficit-ring sm:size-5"
              />
              {title}
            </h2>
            {line && <p className="m-0 text-title font-semibold text-koshur-silk lg:text-heading">{line}</p>}
            {behind && (
              <p className="m-0 text-body-sm text-koshur-muted">
                {BEHIND[behind.key]},{' '}
                <span className="font-semibold text-koshur-silk">
                  {formatNumber(Math.round(behind.eaten))} of {formatNumber(behind.target)} g
                </span>
                .
              </p>
            )}
            {alert && (
              <p className="m-0 flex items-start gap-2 text-body-sm text-koshur-muted">
                <TriangleAlert
                  aria-hidden="true"
                  size={20}
                  strokeWidth={2}
                  className="mt-0.5 size-4 shrink-0 text-alert-surplus sm:mt-0 sm:size-5"
                />
                <span>
                  Sodium is high, mostly from {alert.mostFrom}:{' '}
                  <span className="font-semibold text-koshur-silk">
                    {formatNumber(Math.round(alert.totalMg))} mg
                  </span>
                </span>
              </p>
            )}
          </section>
        ) : (
          children && <div className="flex flex-col items-start gap-3">{children}</div>
        )}
        <div className="grid w-full grid-cols-3 gap-3 border-t border-koshur-border pt-4.5 lg:gap-4 lg:border-t-0 lg:pt-0">
          {MACROS.map(({ key, label, bar }) => {
            const goal = macroTargets?.[key]
            return (
              <p key={key} className="m-0 flex min-w-0 flex-col gap-1.5">
                <span className="text-caption text-koshur-muted">{label}</span>
                <span className="flex flex-col text-body font-semibold text-koshur-silk sm:flex-row sm:items-baseline sm:gap-1">
                  {goal ? (
                    <>
                      <span>{formatNumber(shown[key])}</span>
                      {/* Reads "of 128 g" under the number on phones and "/ 128 g" beside it from tablets up (index.css). */}
                      <span className="macro-target text-caption font-normal text-koshur-muted sm:text-body">
                        {formatNumber(goal)} g
                      </span>
                    </>
                  ) : (
                    <span>{formatNumber(shown[key])} g</span>
                  )}
                </span>
                {goal ? (
                  <span aria-hidden="true" className="block h-1.5 rounded-full bg-koshur-border">
                    <span
                      className={`block h-1.5 rounded-full ${bar}`}
                      style={{ width: `${Math.min(100, (totals[key] / goal) * 100)}%` }}
                    />
                  </span>
                ) : (
                  // Without a target there is no progress to show, only which color is which.
                  <span aria-hidden="true" className={`block h-1.5 w-6 rounded-full ${bar}`} />
                )}
              </p>
            )
          })}
        </div>
        {!alert && (
          <p className="m-0 text-body-sm text-koshur-muted">
            Sodium so far <span className="font-semibold text-koshur-silk">{formatNumber(sodium)} mg</span> of{' '}
            {formatNumber(SODIUM_LIMIT_MG)}
          </p>
        )}
      </div>
    </section>
  )
}
