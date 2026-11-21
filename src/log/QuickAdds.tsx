import { ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '../components/Button.tsx'
import type { LoggedFood } from '../lib/dayLogs.ts'
import {
  amountLabel,
  defaultQuantity,
  defaultUnit,
  foodsLine,
  formatNumber,
  totalKcal,
} from '../lib/foodDisplay.ts'
import type { FoodResult, FoodUnit } from '../lib/foodSearch.ts'
import { mealPhrase, type Meal } from '../lib/meals.ts'
import { toFoodResult, type MyFood } from '../lib/myFoods.ts'
import type { SavedMeal } from '../lib/savedMeals.ts'
import { groupMealFoods } from '../lib/today.ts'
import { FoodRow } from './FoodRow.tsx'
import { FromPackLink } from './FromPack.tsx'
import { useSheetFill } from './fill.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'
const EYEBROW = 'm-0 text-caption font-semibold tracking-wide text-koshur-muted uppercase'

interface QuickAddsProps {
  meal: Meal
  yesterday: readonly LoggedFood[]
  /** null until they have loaded. */
  saved: readonly SavedMeal[] | null
  /** The person's own foods; null until they have loaded. */
  mine: readonly MyFood[] | null
  busy: boolean
  onAddYesterday: (foods: LoggedFood[]) => void
  onAddSaved: (saved: SavedMeal) => void
  onOpenSaved: (saved: SavedMeal) => void
  /** A food of their own opened to choose the amount, or added in one tap with its first unit. */
  onOpenMine: (food: FoodResult, unit: FoodUnit, quantity: number) => void
  onAddMine: (food: FoodResult, unit: FoodUnit, quantity: number) => void
  onAddFromPack: () => void
}

type Tab = 'yesterday' | 'saved' | 'mine'

const TAB_LABELS: Record<Tab, string> = { yesterday: 'Yesterday', saved: 'Saved meals', mine: 'My foods' }

/**
 * The fastest ways to fill a meal, shown under the search while nothing is typed, as three tabs so
 * only one list shows at a time: what yesterday's same meal held, added in one tap; the person's
 * saved meals; and their own foods. A tab shows only when it has something in it.
 */
export function QuickAdds({
  meal,
  yesterday,
  saved,
  mine,
  busy,
  onAddYesterday,
  onAddSaved,
  onOpenSaved,
  onOpenMine,
  onAddMine,
  onAddFromPack,
}: QuickAddsProps) {
  const yesterdayId = useId()
  const yesterdayListId = useId()
  const mineId = useId()
  const savedId = useId()
  const fill = useSheetFill()
  const phrase = mealPhrase(meal)
  const repeat = yesterday.filter((log) => log.meal === meal)
  const [chosen, setChosen] = useState<Tab | null>(null)
  const [showYesterdayFoods, setShowYesterdayFoods] = useState(false)
  const available: Tab[] = []
  if (repeat.length > 0) available.push('yesterday')
  if (saved && saved.length > 0) available.push('saved')
  if (mine && mine.length > 0) available.push('mine')
  if (available.length === 0) return null
  const tab = chosen && available.includes(chosen) ? chosen : available[0]
  return (
    <>
      <fieldset
        className={`m-0 grid grid-flow-col auto-cols-fr gap-1 rounded-xl border border-koshur-border ${fill} p-1`}
      >
        <legend className="sr-only">Quick adds</legend>
        {available.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === tab}
            onClick={() => setChosen(option)}
            className={`min-h-11 rounded-lg px-2 text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring ${
              option === tab
                ? 'bg-deficit-ring font-semibold text-koshur-surface dark:text-koshur-base'
                : 'font-medium text-koshur-muted hover:text-koshur-silk'
            }`}
          >
            {TAB_LABELS[option]}
          </button>
        ))}
      </fieldset>
      {tab === 'yesterday' && (
        <section aria-labelledby={yesterdayId} className="flex flex-col gap-2">
          <h3 id={yesterdayId} className={`${EYEBROW} flex justify-between gap-3`}>
            <span>Yesterday's {phrase}</span>
            <span className="tracking-normal text-koshur-silk normal-case">
              {formatNumber(totalKcal(repeat))} kcal
            </span>
          </h3>
          <div className={`flex flex-col rounded-xl border border-koshur-border ${fill} p-3.5 gap-3`}>
            <button
              type="button"
              onClick={() => setShowYesterdayFoods((open) => !open)}
              aria-expanded={showYesterdayFoods}
              aria-controls={yesterdayListId}
              className={`group flex w-full flex-col gap-0.5 rounded-lg text-left transition-colors ${FOCUS_RING}`}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <span className="text-body-sm font-semibold text-koshur-silk">
                  Check yesterday's {phrase}
                </span>
                <div className="flex shrink-0 items-center gap-1.5 text-caption font-medium text-koshur-muted transition-colors group-hover:text-koshur-silk">
                  <span>{showYesterdayFoods ? 'Show less' : 'Show more'}</span>
                  <ChevronRight
                    aria-hidden="true"
                    size={16}
                    strokeWidth={2}
                    className={`size-3.5 transition-transform duration-200 ${
                      showYesterdayFoods ? 'rotate-90 text-deficit-ring' : ''
                    }`}
                  />
                </div>
              </div>
              <span className="text-caption text-koshur-muted">
                {repeat.length} {repeat.length === 1 ? 'food' : 'foods'}
              </span>
            </button>
            {showYesterdayFoods && (
              <div className="flex flex-col gap-3.5 border-t border-koshur-border pt-3">
                <ul id={yesterdayListId} className="m-0 flex list-none flex-col p-0">
                  {groupMealFoods(repeat).map((entry) => {
                    const log = entry.logs[entry.logs.length - 1]
                    const amount = amountLabel(log.quantity, {
                      name: log.unitName,
                      grams: log.grams / log.quantity,
                    })
                    return (
                      <li
                        key={entry.logs[0].id}
                        className="flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0"
                      >
                        <span className="min-w-0 truncate text-body-sm text-koshur-silk">
                          {log.foodName}
                          {entry.logs.length > 1 && (
                            <span className="text-koshur-muted"> ×{entry.logs.length}</span>
                          )}
                        </span>{' '}
                        <span className="shrink-0 text-caption text-koshur-muted">
                          {amount} · {formatNumber(entry.totals.kcal)} kcal
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <div className="flex items-center justify-start pt-1.5">
                  <Button
                    variant="primary"
                    size="small"
                    disabled={busy}
                    onClick={() => onAddYesterday(repeat)}
                    aria-label={`Add all of yesterday's ${phrase}`}
                  >
                    Add all
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      {tab === 'mine' && mine && (
        <section aria-labelledby={mineId} className="flex flex-col gap-1.5">
          <h3 id={mineId} className="sr-only">
            My foods
          </h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {mine.map((own) => {
              const food = toFoodResult(own)
              const unit = defaultUnit(food)
              const quantity = defaultQuantity(unit)
              return (
                <FoodRow
                  key={own.id}
                  food={food}
                  unit={unit}
                  quantity={quantity}
                  busy={busy}
                  onOpen={() => onOpenMine(food, unit, quantity)}
                  onQuickAdd={() => onAddMine(food, unit, quantity)}
                />
              )
            })}
          </ul>
          <FromPackLink onClick={onAddFromPack}>Add a food from its pack</FromPackLink>
        </section>
      )}
      {tab === 'saved' && saved && (
        <section aria-labelledby={savedId} className="flex flex-col gap-1.5">
          <h3 id={savedId} className="sr-only">
            Saved meals
          </h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {saved.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 border-b border-koshur-border py-3">
                <button
                  type="button"
                  onClick={() => onOpenSaved(entry)}
                  className={`flex min-h-11 min-w-0 flex-1 flex-col items-start gap-1.5 rounded-xl text-left ${FOCUS_RING}`}
                >
                  <span className="text-body-sm font-medium text-koshur-silk sm:text-body">{entry.name}</span>
                  {/* The space keeps the parts apart when read aloud; the gap spaces them on screen. */}
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-koshur-muted">
                    <span className="whitespace-nowrap">
                      <span className="text-body-sm font-semibold text-koshur-silk">
                        {formatNumber(totalKcal(entry.foods))}
                      </span>{' '}
                      kcal
                    </span>{' '}
                    <span>{foodsLine(entry.foods)}</span>
                  </span>
                </button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => onAddSaved(entry)}
                  disabled={busy}
                  aria-label={`Add ${entry.name} to ${phrase}`}
                  className="shrink-0"
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
