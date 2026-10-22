import { useId } from 'react'
import { formatNumber } from '../lib/foodDisplay.ts'
import { MEAL_LABELS } from '../lib/meals.ts'
import { mealFoodNames, type MealGroup } from '../lib/today.ts'

/** The day's meals in the order of the day, each with its foods and calories. */
export function MealList({ groups }: { groups: MealGroup[] }) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2.5 lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-koshur-border lg:bg-koshur-surface"
    >
      <h2
        id={headingId}
        className="m-0 px-1 text-title font-semibold lg:border-b lg:border-koshur-border lg:px-6 lg:py-4.5 lg:text-body"
      >
        Meals
      </h2>
      <ul className="m-0 list-none overflow-hidden rounded-2xl border border-koshur-border bg-koshur-surface p-0 lg:rounded-none lg:border-0">
        {groups.map((group) => (
          <li
            key={group.meal}
            className="flex min-h-16 items-center gap-3 border-b border-koshur-border px-4 py-3 last:border-b-0 lg:min-h-15 lg:gap-4 lg:px-6 lg:py-2.5"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-row lg:items-center lg:gap-4">
              <span className="text-body font-semibold text-koshur-silk lg:w-30 lg:shrink-0 lg:text-body-sm">
                {MEAL_LABELS[group.meal]}
              </span>
              <span className="truncate text-body-sm text-koshur-muted lg:text-body">
                {mealFoodNames(group)}
              </span>
            </span>
            <span className="shrink-0 text-body font-medium text-koshur-silk">
              {formatNumber(Math.round(group.totals.kcal))}
              <span className="sr-only"> kcal</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
