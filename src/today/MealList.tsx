import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { useId, useState, type Ref } from 'react'
import { Link } from 'wouter'
import type { LoggedFood } from '../lib/dayLogs.ts'
import { amountLabel, formatNumber } from '../lib/foodDisplay.ts'
import { MEAL_LABELS, type Meal } from '../lib/meals.ts'
import { mealFoodNames, type MealGroup } from '../lib/today.ts'
import { editLogPath } from '../shell/nav.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'
const ICON_BUTTON = `flex size-11 shrink-0 items-center justify-center rounded-xl border border-koshur-border bg-koshur-base ${FOCUS_RING}`

interface FoodItemProps {
  food: LoggedFood
  busy: boolean
  onRemove: (food: LoggedFood) => void
}

function FoodItem({ food, busy, onRemove }: FoodItemProps) {
  const amount = amountLabel(food.quantity, { name: food.unitName, grams: food.grams / food.quantity })
  return (
    <li className="flex items-center gap-3 border-t border-koshur-border px-4 py-2.5 lg:px-6">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body text-koshur-silk">{food.foodName}</span>
        <span className="text-caption text-koshur-muted">
          {amount} · {formatNumber(Math.round(food.nutrients.kcal))} kcal
        </span>
      </span>
      <Link
        href={editLogPath(food.id)}
        aria-label={`Change ${food.foodName}`}
        className={`${ICON_BUTTON} text-koshur-silk`}
      >
        <Pencil aria-hidden="true" size={20} strokeWidth={2} />
      </Link>
      <button
        type="button"
        onClick={() => onRemove(food)}
        disabled={busy}
        aria-label={`Remove ${food.foodName}`}
        className={`${ICON_BUTTON} text-koshur-muted disabled:opacity-60`}
      >
        <Trash2 aria-hidden="true" size={20} strokeWidth={2} />
      </button>
    </li>
  )
}

interface MealRowProps {
  group: MealGroup
  open: boolean
  busy: boolean
  onToggle: () => void
  onRemove: (food: LoggedFood) => void
}

function MealRow({ group, open, busy, onToggle, onRemove }: MealRowProps) {
  const panelId = useId()
  return (
    <li className="border-b border-koshur-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left lg:min-h-15 lg:gap-4 lg:px-6 lg:py-2.5 ${FOCUS_RING} focus-visible:ring-inset`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-row lg:items-center lg:gap-4">
          <span className="text-body font-semibold text-koshur-silk lg:w-30 lg:shrink-0 lg:text-body-sm">
            {MEAL_LABELS[group.meal]}
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
        <ul id={panelId} className="m-0 list-none p-0">
          {group.foods.map((food) => (
            <FoodItem key={food.id} food={food} busy={busy} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </li>
  )
}

interface MealListProps {
  groups: MealGroup[]
  /** While a removal is on its way, no other food can be removed. */
  busy?: boolean
  onRemove: (food: LoggedFood) => void
  headingRef?: Ref<HTMLHeadingElement>
}

/** The day's meals in the order of the day. Opening one lists its foods, to change or remove them. */
export function MealList({ groups, busy = false, onRemove, headingRef }: MealListProps) {
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
