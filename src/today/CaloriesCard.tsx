import { formatNumber } from '../lib/foodDisplay.ts'
import { roundForDisplay, type Nutrients } from '../lib/nutrition.ts'
import { ringState } from '../lib/today.ts'
import { Ring } from './Ring.tsx'

const MACROS = [
  { key: 'protein', label: 'Protein', bar: 'bg-macro-protein' },
  { key: 'carbs', label: 'Carbs', bar: 'bg-macro-carb' },
  { key: 'fat', label: 'Fat', bar: 'bg-macro-fat' },
] as const

type MacroTargets = Pick<Nutrients, 'protein' | 'carbs' | 'fat'>

interface CaloriesCardProps {
  totals: Nutrients
  /** The daily calorie target, once the person has one. */
  target?: number | null
  macroTargets?: MacroTargets | null
}

/** The day's calories as a ring, then protein, carbs and fat, always in that order. */
export function CaloriesCard({ totals, target = null, macroTargets = null }: CaloriesCardProps) {
  const state = ringState(totals.kcal, target)
  const shown = roundForDisplay(totals)
  return (
    <section
      aria-label="Calories and macros"
      className="flex flex-col items-center gap-5.5 rounded-2xl border border-koshur-border bg-koshur-surface px-5 pt-6 pb-5 lg:flex-row lg:flex-wrap lg:gap-7 lg:p-6"
    >
      <Ring state={state} />
      <div className="flex w-full flex-col items-center gap-5.5 lg:w-auto lg:min-w-0 lg:flex-1 lg:basis-65 lg:items-stretch lg:gap-4">
        {state.kind !== 'eaten' && (
          <p className="m-0 text-body-sm text-koshur-muted">
            <span className="font-semibold text-koshur-silk">{formatNumber(state.eaten)}</span> eaten of{' '}
            {formatNumber(state.target)} kcal
          </p>
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
      </div>
    </section>
  )
}
