import { Check } from 'lucide-react'
import { Button } from '../components/Button.tsx'
import {
  amountLabel,
  amountWithGrams,
  isEstimate,
  nutrientsFor,
  showsVerified,
  sourceTag,
} from '../lib/foodDisplay.ts'
import type { FoodResult, FoodUnit } from '../lib/foodSearch.ts'
import { FoodValues } from './FoodValues.tsx'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

interface FoodRowProps {
  food: FoodResult
  unit: FoodUnit
  quantity: number
  onOpen: () => void
  /** Recent foods add again in one tap, with the amount used last time. */
  onQuickAdd?: () => void
  /** An Add button that opens the food to choose the amount, as in the Add food popup: nothing is added until the person says so. */
  withPlus?: boolean
  busy?: boolean
}

/**
 * One food in a list, on two clear lines: its name, then its protein and calories for the amount
 * shown (one piece for a food eaten whole, 100 g for one weighed, or the amount last used), and a
 * small tag where it says something. Tapping it opens the food.
 */
export function FoodRow({
  food,
  unit,
  quantity,
  onOpen,
  onQuickAdd,
  withPlus = false,
  busy = false,
}: FoodRowProps) {
  const amount = amountLabel(quantity, unit)
  const values = nutrientsFor(food, quantity, unit)
  const tag = sourceTag(food)
  return (
    <li className="flex items-center gap-3 border-b border-koshur-border py-3">
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-h-11 min-w-0 flex-1 flex-col items-start gap-1 rounded-xl text-left ${FOCUS_RING}`}
      >
        <span className="text-body-sm font-medium text-koshur-silk sm:text-body">{food.name}</span>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-koshur-muted">
          {values && (
            <FoodValues
              nutrients={values}
              amount={amountWithGrams(quantity, unit)}
              about={isEstimate(food)}
            />
          )}
          {tag && (
            <>
              {' '}
              <span className="inline-flex h-5 items-center rounded-md border border-koshur-border px-1.5 whitespace-nowrap">
                {tag}
              </span>
            </>
          )}
          {showsVerified(food) && (
            <>
              {' '}
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Check aria-hidden="true" size={20} strokeWidth={2} className="size-4" />
                Verified
              </span>
            </>
          )}
        </span>
      </button>
      {(onQuickAdd || withPlus) && (
        <Button
          variant="secondary"
          size="small"
          onClick={onQuickAdd ?? onOpen}
          disabled={busy}
          aria-label={onQuickAdd ? `Add ${amount} ${food.name}` : `Add ${food.name}`}
          className="shrink-0"
        >
          Add
        </Button>
      )}
    </li>
  )
}
