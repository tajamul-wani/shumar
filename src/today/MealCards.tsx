import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useId, type Ref } from 'react'
import { Link } from 'wouter'
import { AmountChip } from '../components/AmountChip.tsx'
import type { LoggedFood } from '../lib/dayLogs.ts'
import { formatMealTime } from '../lib/dates.ts'
import { amountLabel, formatNumber } from '../lib/foodDisplay.ts'
import { mealLabel, mealPhrase, type Meal } from '../lib/meals.ts'
import { biggestMeal, groupMealFoods, type FoodEntry, type MealGroup } from '../lib/today.ts'
import { editLogPath } from '../shell/nav.ts'
import { Amounts, Kcal, MacroBar } from './amounts.tsx'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'
// Edit and Remove are icon buttons beside the food, 44 px targets with 16 px icons.
const ACTION_BUTTON = `inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-koshur-border bg-koshur-base text-koshur-silk transition-colors hover:border-deficit-ring hover:text-deficit-ring disabled:opacity-60 ${FOCUS_RING}`

interface EntryItemProps {
  entry: FoodEntry
  busy: boolean
  /** Without it the list is read only, as on a past day opened from Trends. */
  onRemove?: (food: LoggedFood) => void
}

/**
 * One food in a meal: its name (with a count when the same food in the same amount was logged more
 * than once), the amount as a chip, its sodium, its calories, and Edit and Remove.
 */
function EntryItem({ entry, busy, onRemove }: EntryItemProps) {
  const count = entry.logs.length
  // The latest one, so Edit and Remove act on the one most likely added by mistake.
  const food = entry.logs[count - 1]
  const amount = amountLabel(food.quantity, { name: food.unitName, grams: food.grams / food.quantity })
  const one = count > 1 ? 'one ' : ''
  return (
    <li className="flex items-center gap-3 border-t border-koshur-border py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm text-koshur-silk">
          <span>{food.foodName}</span>
          {count > 1 && (
            <>
              <span
                aria-hidden="true"
                className="inline-flex items-center rounded-full bg-koshur-border px-2 py-0.5 text-caption font-semibold text-koshur-silk"
              >
                ×{count}
              </span>
              <span className="sr-only">{count} times, </span>
            </>
          )}
        </p>
        {/* The spaces keep the parts apart when read aloud; the gap spaces them on screen. */}
        <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-koshur-muted">
          <AmountChip>
            {amount}
            {count > 1 ? ' each' : ''}
          </AmountChip>{' '}
          <Kcal value={entry.totals.kcal} size="caption" />{' '}
          <span className="whitespace-nowrap">
            Sodium{' '}
            <span className="font-semibold text-koshur-silk">
              {formatNumber(Math.round(entry.totals.sodiumMg))} mg
            </span>
          </span>
        </p>
      </div>
      {onRemove && (
        <div className="flex shrink-0 gap-2">
          <Link
            href={editLogPath(food.id)}
            aria-label={`Edit ${one}${food.foodName}`}
            className={ACTION_BUTTON}
          >
            <Pencil aria-hidden="true" size={20} strokeWidth={2} className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => onRemove(food)}
            disabled={busy}
            aria-label={`Remove ${one}${food.foodName}`}
            className={ACTION_BUTTON}
          >
            <Trash2 aria-hidden="true" size={20} strokeWidth={2} className="size-4" />
          </button>
        </div>
      )}
    </li>
  )
}

interface MealCardProps {
  group: MealGroup
  /** The whole day's calories, for the meal's share of it. */
  dayKcal: number
  biggest: boolean
  showTime: boolean
  busy: boolean
  onRemove?: (food: LoggedFood) => void
  onAdd?: (meal: Meal) => void
}

/**
 * A meal as a card: its name as a bordered tag, the time of its first food, its calories and share
 * of the day, a bar of its macros, every food listed, and a way to add to it.
 */
function MealCard({ group, dayKcal, biggest, showTime, busy, onRemove, onAdd }: MealCardProps) {
  const headingId = useId()
  const share = dayKcal > 0 ? Math.round((group.totals.kcal / dayKcal) * 100) : 0
  return (
    <article
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-koshur-border bg-koshur-surface p-4 lg:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h3
            id={headingId}
            className="m-0 inline-flex min-h-8 items-center rounded-full border border-koshur-border px-3 text-body-sm font-semibold text-koshur-silk"
          >
            {mealLabel(group.meal)}
          </h3>
          {showTime && (
            <span className="text-caption text-koshur-muted">
              {formatMealTime(new Date(group.firstLoggedAt))}
            </span>
          )}
          {biggest && (
            <span className="inline-flex items-center rounded-md border border-deficit-ring px-1.5 text-caption font-semibold tracking-wide text-deficit-ring uppercase">
              Biggest meal
            </span>
          )}
        </div>
        <p className="m-0 flex items-baseline gap-2">
          <Kcal value={group.totals.kcal} size="large" />
          <span className="text-caption whitespace-nowrap text-koshur-muted">{share}% of today</span>
        </p>
      </div>
      <MacroBar nutrients={group.totals} />
      <Amounts nutrients={group.totals} />
      <ul className="m-0 flex list-none flex-col p-0">
        {groupMealFoods(group.foods).map((entry) => (
          <EntryItem key={entry.logs[0].id} entry={entry} busy={busy} onRemove={onRemove} />
        ))}
      </ul>
      {onAdd && (
        <button
          type="button"
          onClick={() => onAdd(group.meal)}
          className={`inline-flex min-h-11 items-center gap-2 self-start rounded-xl text-body-sm font-semibold text-deficit-ring transition-opacity hover:opacity-80 ${FOCUS_RING}`}
        >
          <Plus aria-hidden="true" size={20} strokeWidth={2.5} className="size-4" />
          Add to {mealPhrase(group.meal)}
        </button>
      )}
    </article>
  )
}

interface MealCardsProps {
  groups: MealGroup[]
  /** The whole day's calories, for each meal's share of it. */
  dayKcal: number
  /** The time of each meal's first food. */
  showTimes?: boolean
  /** While a removal is on its way, no other food can be removed. */
  busy?: boolean
  onRemove?: (food: LoggedFood) => void
  /** Opens the Add food popup on that meal. Without it, as on a past day, cards have no add line. */
  onAdd?: (meal: Meal) => void
  headingRef?: Ref<HTMLHeadingElement>
}

/** The day's meals as cards, two across on wide screens, each with its foods listed. */
export function MealCards({
  groups,
  dayKcal,
  showTimes = false,
  busy = false,
  onRemove,
  onAdd,
  headingRef,
}: MealCardsProps) {
  const headingId = useId()
  const biggest = biggestMeal(groups)
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 lg:gap-4">
      <h2
        ref={headingRef}
        id={headingId}
        tabIndex={-1}
        className="m-0 text-title font-semibold focus:outline-none"
      >
        Meals
      </h2>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-6 lg:items-start">
        {groups.map((group) => (
          <MealCard
            key={group.meal}
            group={group}
            dayKcal={dayKcal}
            biggest={group.meal === biggest}
            showTime={showTimes}
            busy={busy}
            onRemove={onRemove}
            onAdd={onAdd}
          />
        ))}
      </div>
    </section>
  )
}
