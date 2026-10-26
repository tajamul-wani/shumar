import { ChevronLeft, Trash2 } from 'lucide-react'
import { Alert } from '../components/Alert.tsx'
import { AmountChip } from '../components/AmountChip.tsx'
import { Button } from '../components/Button.tsx'
import { amountLabel } from '../lib/foodDisplay.ts'
import type { Nutrients } from '../lib/nutrition.ts'
import type { SavedFood, SavedMeal } from '../lib/savedMeals.ts'
import { Amounts, Kcal, MacroBar } from '../today/amounts.tsx'
import { useSheetFill } from './fill.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

function total(foods: readonly SavedFood[]): Nutrients {
  const sum = { kcal: 0, protein: 0, carbs: 0, fat: 0, sodiumMg: 0 }
  for (const { nutrients } of foods) {
    sum.kcal += nutrients.kcal
    sum.protein += nutrients.protein
    sum.carbs += nutrients.carbs
    sum.fat += nutrients.fat
    sum.sodiumMg += nutrients.sodiumMg
  }
  return sum
}

interface SavedMealViewProps {
  saved: SavedMeal
  /** The meal it would be added to, such as "breakfast". */
  mealName: string
  /** 1 on a screen of its own, 2 inside another screen. */
  headingLevel: 1 | 2
  busy: boolean
  error: string | null
  onBack: () => void
  onAddToMeal: () => void
  onAddFood: () => void
  onRemoveFood: (food: SavedFood) => void
  onRemove: () => void
}

/** A saved meal opened from its row: its foods, what they add up to, and what can be done with it. */
export function SavedMealView({
  saved,
  mealName,
  headingLevel,
  busy,
  error,
  onBack,
  onAddToMeal,
  onAddFood,
  onRemoveFood,
  onRemove,
}: SavedMealViewProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h1'
  const fill = useSheetFill()
  const totals = total(saved.foods)
  return (
    <>
      {/* The name can wrap, so the back button aligns with its first line rather than the middle. */}
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to search"
          className={`-mt-2 -ml-2.5 flex size-11 shrink-0 items-center justify-center rounded-xl text-koshur-silk sm:-mt-1.5 ${FOCUS_RING}`}
        >
          <ChevronLeft aria-hidden="true" size={24} strokeWidth={2} className="size-5 sm:size-6" />
        </button>
        <Heading
          tabIndex={-1}
          className="m-0 min-w-0 flex-1 text-title font-semibold focus:outline-none sm:text-heading"
        >
          {saved.name}
        </Heading>
      </div>

      {error && <Alert>{error}</Alert>}

      <ul aria-label={`Foods in ${saved.name}`} className="m-0 flex list-none flex-col p-0">
        {saved.foods.map((food) => (
          <li key={food.id} className="flex items-center gap-3 border-b border-koshur-border py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="m-0 text-body-sm font-medium text-koshur-silk sm:text-body">{food.foodName}</p>
              {/* The space keeps the parts apart when read aloud; the gap spaces them on screen. */}
              <p className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-koshur-muted">
                <AmountChip>
                  {amountLabel(food.quantity, { name: food.unitName, grams: food.grams / food.quantity })}
                </AmountChip>{' '}
                <Kcal value={food.nutrients.kcal} size="caption" />
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemoveFood(food)}
              disabled={busy}
              aria-label={`Remove ${food.foodName} from ${saved.name}`}
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl border border-koshur-border ${fill} text-koshur-silk disabled:opacity-60 ${FOCUS_RING}`}
            >
              <Trash2 aria-hidden="true" size={20} strokeWidth={2} className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <p className="m-0 flex items-baseline gap-2">
          <Kcal value={totals.kcal} size="large" />
          <span className="text-caption text-koshur-muted">in all</span>
        </p>
        <MacroBar nutrients={totals} />
        <Amounts nutrients={totals} withSodium />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="small" disabled={busy} onClick={onAddToMeal}>
          Add to {mealName}
        </Button>
        <Button variant="secondary" size="small" disabled={busy} onClick={onAddFood}>
          Add a food
        </Button>
        <Button variant="secondary" size="small" disabled={busy} onClick={onRemove}>
          Remove saved meal
        </Button>
      </div>
    </>
  )
}
