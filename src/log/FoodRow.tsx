import { Check, Plus } from 'lucide-react'
import {
  amountLabel,
  formatNumber,
  isEstimate,
  nutrientsFor,
  showsVerified,
  sourceLabel,
} from '../lib/foodDisplay.ts'
import type { FoodResult, FoodUnit } from '../lib/foodSearch.ts'
import { useSheetFill } from './fill.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

interface FoodRowProps {
  food: FoodResult
  unit: FoodUnit
  quantity: number
  onOpen: () => void
  /** Recent foods add again in one tap, with the amount used last time. */
  onQuickAdd?: () => void
  busy?: boolean
}

/** One food in a list: its name, then "1 cup · 208 kcal · Ingredient". Tapping it opens the food. */
export function FoodRow({ food, unit, quantity, onOpen, onQuickAdd, busy = false }: FoodRowProps) {
  const amount = amountLabel(quantity, unit)
  const kcal = nutrientsFor(food, quantity, unit)?.kcal ?? 0
  const estimate = isEstimate(food)
  const fill = useSheetFill()
  return (
    <li className="flex items-center gap-3 border-b border-koshur-border py-3">
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-h-11 min-w-0 flex-1 flex-col items-start gap-0.5 rounded-xl text-left ${FOCUS_RING}`}
      >
        <span className="text-body-sm font-medium text-koshur-silk sm:text-body">{food.name}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-caption text-koshur-muted">
          <span>
            {amount} · {estimate ? 'about ' : ''}
            {formatNumber(kcal)} kcal · {estimate ? 'Estimate' : sourceLabel(food)}
          </span>
          {showsVerified(food) && (
            <span className="inline-flex items-center gap-1">
              <Check aria-hidden="true" size={20} strokeWidth={2} className="size-4 sm:size-5" />
              Verified
            </span>
          )}
        </span>
      </button>
      {onQuickAdd && (
        <button
          type="button"
          onClick={onQuickAdd}
          disabled={busy}
          aria-label={`Add ${amount} ${food.name}`}
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl border border-koshur-border ${fill} text-deficit-ring disabled:opacity-60 ${FOCUS_RING}`}
        >
          <Plus aria-hidden="true" size={20} strokeWidth={2} className="size-4 sm:size-5" />
        </button>
      )}
    </li>
  )
}
