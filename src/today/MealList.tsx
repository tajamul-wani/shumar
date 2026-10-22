import {
  ChevronDown,
  ChevronRight,
  Coffee,
  Cookie,
  Moon,
  Sun,
  Sunrise,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useId, useState, type Ref } from 'react'
import { Link } from 'wouter'
import type { LoggedFood } from '../lib/dayLogs.ts'
import { formatMealTime } from '../lib/dates.ts'
import { amountLabel, formatNumber } from '../lib/foodDisplay.ts'
import { MEAL_LABELS, type Meal } from '../lib/meals.ts'
import { groupMealFoods, mealFoodNames, type FoodEntry, type MealGroup } from '../lib/today.ts'
import { editLogPath } from '../shell/nav.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'
// On the darker inset of an open meal, so the card color makes the button stand out.
const ICON_BUTTON = `flex size-11 shrink-0 items-center justify-center rounded-xl border border-koshur-border bg-koshur-surface ${FOCUS_RING}`

/** A small sign for each meal, so the list reads at a glance. */
const MEAL_ICONS: Record<Meal, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  evening_tea: Coffee,
  dinner: Moon,
  snack: Cookie,
}

interface EntryItemProps {
  entry: FoodEntry
  busy: boolean
  onRemove: (food: LoggedFood) => void
}

/**
 * One food in an open meal. The same food in the same amount, logged several times, shows once
 * with its count ("×3") and their calories together. Tapping the food changes it; the bin removes
 * it. Both act on one of them. On small phones the name gets almost the full width.
 */
function EntryItem({ entry, busy, onRemove }: EntryItemProps) {
  const count = entry.logs.length
  // The latest one, so Remove takes away the one most likely added by mistake.
  const food = entry.logs[count - 1]
  const amount = amountLabel(food.quantity, { name: food.unitName, grams: food.grams / food.quantity })
  const one = count > 1 ? 'one ' : ''
  return (
    <li className="flex items-center gap-2 border-t border-koshur-border px-4 py-2 lg:px-6">
      <Link
        href={editLogPath(food.id)}
        className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl py-0.5 ${FOCUS_RING}`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body text-koshur-silk">
            <span className="sr-only">{count > 1 ? 'Change one' : 'Change'}</span> {food.foodName}
            {count > 1 && (
              <>
                {' '}
                <span
                  aria-hidden="true"
                  className="ml-1 inline-flex items-center rounded-full bg-koshur-border px-2 py-0.5 align-middle text-caption font-semibold text-koshur-silk"
                >
                  ×{count}
                </span>
                <span className="sr-only">, {count} times</span>
              </>
            )}
          </span>{' '}
          {/* The space above keeps the name and amount apart when read aloud; the column hides it. */}
          <span className="text-caption text-koshur-muted">
            {amount}
            {count > 1 ? ' each' : ''} · {formatNumber(Math.round(entry.totals.kcal))} kcal
          </span>
        </span>
        <ChevronRight aria-hidden="true" size={20} strokeWidth={2} className="shrink-0 text-koshur-muted" />
      </Link>
      <button
        type="button"
        onClick={() => onRemove(food)}
        disabled={busy}
        aria-label={`Remove ${one}${food.foodName}`}
        className={`${ICON_BUTTON} text-koshur-muted disabled:opacity-60`}
      >
        <Trash2 aria-hidden="true" size={20} strokeWidth={2} />
      </button>
    </li>
  )
}

interface MealRowProps {
  group: MealGroup
  showTime: boolean
  open: boolean
  busy: boolean
  onToggle: () => void
  onRemove: (food: LoggedFood) => void
}

function MealRow({ group, showTime, open, busy, onToggle, onRemove }: MealRowProps) {
  const panelId = useId()
  const Icon = MEAL_ICONS[group.meal]
  return (
    <li className="border-b border-koshur-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left lg:min-h-15 lg:gap-4 lg:px-6 lg:py-2.5 ${FOCUS_RING} focus-visible:ring-inset`}
      >
        <Icon
          aria-hidden="true"
          size={20}
          strokeWidth={2}
          className="mt-1 shrink-0 self-start text-koshur-muted"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-row lg:items-center lg:gap-4">
          <span className="flex flex-col lg:w-36 lg:shrink-0">
            <span className="text-title font-semibold text-koshur-silk">{MEAL_LABELS[group.meal]}</span>
            {showTime && (
              <span className="text-caption text-koshur-muted">
                {formatMealTime(new Date(group.firstLoggedAt))}
              </span>
            )}
          </span>
          <span className="truncate text-body-sm text-koshur-muted lg:text-body">{mealFoodNames(group)}</span>
        </span>
        <span className="shrink-0 text-body font-medium text-koshur-silk">
          {formatNumber(Math.round(group.totals.kcal))}
          <span className="sr-only"> kcal</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          size={20}
          strokeWidth={2}
          className={`shrink-0 text-koshur-muted motion-safe:transition-transform motion-safe:duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul id={panelId} className="m-0 list-none bg-koshur-base p-0">
          {groupMealFoods(group.foods).map((entry) => (
            <EntryItem key={entry.logs[0].id} entry={entry} busy={busy} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </li>
  )
}

interface MealListProps {
  groups: MealGroup[]
  /** The time of each meal's first food, shown on wide screens as the design does. */
  showTimes?: boolean
  /** While a removal is on its way, no other food can be removed. */
  busy?: boolean
  onRemove: (food: LoggedFood) => void
  headingRef?: Ref<HTMLHeadingElement>
}

/** The day's meals in the order of the day. Opening one lists its foods, to change or remove them. */
export function MealList({ groups, showTimes = false, busy = false, onRemove, headingRef }: MealListProps) {
  const headingId = useId()
  const [open, setOpen] = useState<ReadonlySet<Meal>>(() => new Set())

  function toggle(meal: Meal) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(meal)) next.delete(meal)
      else next.add(meal)
      return next
    })
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2.5 lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-koshur-border lg:bg-koshur-surface"
    >
      <h2
        ref={headingRef}
        id={headingId}
        tabIndex={-1}
        className="m-0 px-1 text-title font-semibold focus:outline-none lg:border-b lg:border-koshur-border lg:px-6 lg:py-4.5 lg:text-body"
      >
        Meals
      </h2>
      <ul className="m-0 list-none overflow-hidden rounded-2xl border border-koshur-border bg-koshur-surface p-0 lg:rounded-none lg:border-0">
        {groups.map((group) => (
          <MealRow
            key={group.meal}
            group={group}
            showTime={showTimes}
            open={open.has(group.meal)}
            busy={busy}
            onToggle={() => toggle(group.meal)}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </section>
  )
}
