import { formatNumber } from '../lib/foodDisplay.ts'
import { roundForDisplay, type Nutrients } from '../lib/nutrition.ts'

/**
 * A food's values on one line, the same in every list: protein first, then calories, then how much
 * they are for (Tajamul Wani, 29 October 2026), as in "12.6 g protein · 155 kcal · 2 large (100 g)".
 */
export function FoodValues({
  nutrients,
  amount,
  about = false,
}: {
  nutrients: Nutrients
  amount: string
  /** For values to treat as an estimate. */
  about?: boolean
}) {
  const shown = roundForDisplay(nutrients)
  return (
    <span>
      <span className="text-caption font-semibold text-macro-protein">{formatNumber(shown.protein)} g</span>{' '}
      protein · {about ? 'about ' : ''}
      <span className="text-caption font-semibold text-deficit-ring">{formatNumber(shown.kcal)}</span> kcal ·{' '}
      <span className="whitespace-nowrap">{amount}</span>
    </span>
  )
}
