import { ChevronRight, Plus } from 'lucide-react'
import { useId, type Ref } from 'react'
import { Link } from 'wouter'
import { formatMealTime } from '../lib/dates.ts'
import { amountWithGrams } from '../lib/foodDisplay.ts'
import { mealLabel, mealPhrase, type Meal } from '../lib/meals.ts'
import { biggestMeal, groupMealFoods, type FoodEntry, type MealGroup } from '../lib/today.ts'
import { FoodValues } from '../log/FoodValues.tsx'
import { editLogPath } from '../shell/nav.ts'
import { Amounts, Kcal, MacroBar } from './amounts.tsx'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

/**
 * One food in a meal: its name (with a count when the same food in the same amount was logged more
 * than once), then its protein, calories and amount. On Today the whole row opens the food to
 * change it or remove it (option A, approved by Tajamul Wani on 29 October 2026); on a past day it
 * is read only.
 */
function EntryItem({ entry, editable }: { entry: FoodEntry; editable: boolean }) {
  const count = entry.logs.length
  // The latest one, so a tap changes the one most likely added by mistake.
  const food = entry.logs[count - 1]
  const amount = amountWithGrams(food.quantity, { name: food.unitName, grams: food.grams / food.quantity })
  const content = (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm text-koshur-silk">
        <span>{food.foodName}</span>
        {count > 1 && (
          <>
            <span
              aria-hidden="true"
              className="inline-flex items-center rounded-full bg-koshur-border px-2 py-0.5 text-caption font-semibold text-koshur-silk"
            >
              ×{count}
            </span>
            <span className="sr-only">, {count} times</span>
          </>
        )}
      </span>
      <span className="text-caption text-koshur-muted">
        <span className="sr-only">,</span>{' '}
        <FoodValues nutrients={entry.totals} amount={count > 1 ? `${amount} each` : amount} />
      </span>
    </span>
  )
  return (
    <li className="border-t border-koshur-border">
      {editable ? (
        <Link
          href={editLogPath(food.id)}
          className={`flex min-h-11 items-center gap-3 rounded-xl py-3 ${FOCUS_RING}`}
        >
          {content}
          <span className="sr-only">, change or remove{count > 1 ? ' one' : ''}</span>
          <ChevronRight
            aria-hidden="true"
            size={20}
            strokeWidth={2}
            className="size-4 shrink-0 text-koshur-muted"
          />
        </Link>
      ) : (
        <div className="flex py-3">{content}</div>
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
  editable: boolean
  onAdd?: (meal: Meal) => void
}

/**
 * A meal as a card: its name as a bordered tag, the time of its first food, its calories and share
 * of the day, a bar of its macros, every food listed, and a way to add to it.
 */
function MealCard({ group, dayKcal, biggest, showTime, editable, onAdd }: MealCardProps) {
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
          <EntryItem key={entry.logs[0].id} entry={entry} editable={editable} />
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
  /** Each food opens to be changed or removed. Without it the cards are read only, as on a past day. */
  editable?: boolean
  /** Opens the Add food popup on that meal. Without it, as on a past day, cards have no add line. */
  onAdd?: (meal: Meal) => void
  headingRef?: Ref<HTMLHeadingElement>
}

/** The day's meals as cards, two across on wide screens, each with its foods listed. */
export function MealCards({
  groups,
  dayKcal,
  showTimes = false,
  editable = false,
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
            editable={editable}
            onAdd={onAdd}
          />
        ))}
      </div>
      {editable && (
        <p className="m-0 text-caption text-koshur-muted">
          Tap a food to see all its values, change it or remove it.
        </p>
      )}
    </section>
  )
}
