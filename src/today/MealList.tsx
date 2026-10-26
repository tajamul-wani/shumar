import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { Fragment, useId, useState, type Ref } from 'react'
import { Link } from 'wouter'
import type { LoggedFood } from '../lib/dayLogs.ts'
import { formatMealTime } from '../lib/dates.ts'
import { amountLabel, formatNumber } from '../lib/foodDisplay.ts'
import { mealLabel, type Meal } from '../lib/meals.ts'
import { roundForDisplay, type Nutrients } from '../lib/nutrition.ts'
import { groupMealFoods, type FoodEntry, type MealGroup } from '../lib/today.ts'
import { editLogPath } from '../shell/nav.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'
// On phones Edit and Remove sit under the food with their labels, sharing the full width; from
// 640 px up they are icon buttons beside it. Icons are 16 px, and every button stays a 44 px target.
const ACTION_BUTTON = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-koshur-border bg-koshur-base px-3.5 text-body-sm text-koshur-silk disabled:opacity-60 sm:size-11 sm:px-0 ${FOCUS_RING}`
const SMALL_ICON = 'size-4 sm:size-5'

/**
 * A small dot in a macro or calorie color, shown in light mode only. The light colors are deep
 * enough for small text but look muddy as text, so there the dot carries the color and the number
 * stays near-black; dark mode colors the number itself.
 */
function Dot({ color }: { color: string }) {
  return (
    <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full dark:hidden ${color}`} />
  )
}

/** Calories: saffron in dark mode, a saffron dot and a dark number in light mode. */
function Kcal({ value, size = 'small' }: { value: number; size?: 'small' | 'large' }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Dot color="bg-deficit-ring" />
      <span>
        <span
          className={`font-semibold text-koshur-silk dark:text-deficit-ring ${size === 'large' ? 'text-body sm:text-title' : 'text-caption'}`}
        >
          {formatNumber(Math.round(value))}
        </span>
        <span className="text-caption text-koshur-muted"> kcal</span>
      </span>
    </span>
  )
}

/**
 * Protein, carbs and fat (and sodium for a single food), always with their names, so color is
 * never the only clue: colored numbers in dark mode, colored dots in light mode.
 */
function Amounts({ nutrients, withSodium = false }: { nutrients: Nutrients; withSodium?: boolean }) {
  const shown = roundForDisplay(nutrients)
  const items = [
    {
      label: 'Protein',
      value: `${formatNumber(shown.protein)} g`,
      dot: 'bg-macro-protein',
      dark: 'dark:text-macro-protein',
    },
    {
      label: 'Carbs',
      value: `${formatNumber(shown.carbs)} g`,
      dot: 'bg-macro-carb',
      dark: 'dark:text-macro-carb',
    },
    { label: 'Fat', value: `${formatNumber(shown.fat)} g`, dot: 'bg-macro-fat', dark: 'dark:text-macro-fat' },
    ...(withSodium
      ? [{ label: 'Sodium', value: `${formatNumber(shown.sodiumMg)} mg`, dot: null, dark: '' }]
      : []),
  ]
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-koshur-muted">
      {items.map(({ label, value, dot, dark }) => (
        // The space after each keeps the values apart when read aloud; the flex gap spaces them on screen.
        <Fragment key={label}>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {dot && <Dot color={dot} />}
            <span>
              {label} <span className={`font-semibold text-koshur-silk ${dark}`}>{value}</span>
            </span>
          </span>{' '}
        </Fragment>
      ))}
    </span>
  )
}

interface EntryItemProps {
  entry: FoodEntry
  busy: boolean
  /** Without it the list is read only, as on a past day opened from Trends. */
  onRemove?: (food: LoggedFood) => void
}

/**
 * One food in an open meal, in a smaller size than the meal: its name (with a count when the same
 * food in the same amount was logged more than once), then its amount and calories, then protein,
 * carbs, fat and sodium. Tapping it changes it; the bin removes one.
 */
function EntryItem({ entry, busy, onRemove }: EntryItemProps) {
  const count = entry.logs.length
  // The latest one, so Edit and Remove act on the one most likely added by mistake.
  const food = entry.logs[count - 1]
  const amount = amountLabel(food.quantity, { name: food.unitName, grams: food.grams / food.quantity })
  const one = count > 1 ? 'one ' : ''
  return (
    <li className="flex flex-col gap-3.5 border-t border-koshur-border px-4 py-4 sm:flex-row sm:items-center sm:gap-4 lg:px-6">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="m-0 text-body-sm text-koshur-silk">{food.foodName}</p>
        <p className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-koshur-muted">
          {count > 1 && (
            <>
              <span
                aria-hidden="true"
                className="inline-flex items-center rounded-full bg-koshur-border px-2 py-0.5 font-semibold text-koshur-silk"
              >
                ×{count}
              </span>
              <span className="sr-only">{count} times, </span>
            </>
          )}
          <span>
            {amount}
            {count > 1 ? ' each' : ''} · <Kcal value={entry.totals.kcal} />
          </span>
        </p>
        <Amounts nutrients={entry.totals} withSodium />
      </div>
      {onRemove && (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Link
            href={editLogPath(food.id)}
            aria-label={`Edit ${one}${food.foodName}`}
            className={ACTION_BUTTON}
          >
            <Pencil aria-hidden="true" size={20} strokeWidth={2} className="size-4" />
            <span aria-hidden="true" className="sm:hidden">
              Edit
            </span>
          </Link>
          <button
            type="button"
            onClick={() => onRemove(food)}
            disabled={busy}
            aria-label={`Remove ${one}${food.foodName}`}
            className={ACTION_BUTTON}
          >
            <Trash2 aria-hidden="true" size={20} strokeWidth={2} className="size-4" />
            <span aria-hidden="true" className="sm:hidden">
              {count > 1 ? 'Remove one' : 'Remove'}
            </span>
          </button>
        </div>
      )}
    </li>
  )
}

interface MealRowProps {
  group: MealGroup
  showTime: boolean
  open: boolean
  busy: boolean
  onToggle: () => void
  onRemove?: (food: LoggedFood) => void
}

/** A meal: its name, calories and macros, with its foods listed once opened. */
function MealRow({ group, showTime, open, busy, onToggle, onRemove }: MealRowProps) {
  const panelId = useId()
  return (
    <li className="border-b border-koshur-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`flex min-h-16 w-full items-center gap-3 px-4 py-3.5 text-left lg:px-6 ${FOCUS_RING} focus-visible:ring-inset`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-body font-semibold text-koshur-silk sm:text-title">
              {mealLabel(group.meal)}
            </span>
            {showTime && (
              <span className="text-caption text-koshur-muted">
                {formatMealTime(new Date(group.firstLoggedAt))}
              </span>
            )}
          </span>{' '}
          <Amounts nutrients={group.totals} />
        </span>{' '}
        <Kcal value={group.totals.kcal} size="large" />
        <ChevronDown
          aria-hidden="true"
          size={20}
          strokeWidth={2}
          className={`${SMALL_ICON} shrink-0 text-koshur-muted motion-safe:transition-transform motion-safe:duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul id={panelId} className="m-0 list-none p-0">
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
  onRemove?: (food: LoggedFood) => void
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
