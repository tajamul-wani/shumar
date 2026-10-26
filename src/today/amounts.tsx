import { Fragment } from 'react'
import { formatNumber } from '../lib/foodDisplay.ts'
import { roundForDisplay, type Nutrients } from '../lib/nutrition.ts'
import { macroShares } from '../lib/today.ts'

/**
 * A small dot in a macro or calorie color, shown in light mode only. The light colors are deep
 * enough for small text but look muddy as text, so there the dot carries the color and the number
 * stays near-black; dark mode colors the number itself.
 */
export function Dot({ color }: { color: string }) {
  return (
    <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full dark:hidden ${color}`} />
  )
}

/**
 * Calories. Small sizes: saffron in dark mode, a saffron dot and a dark number in light mode. The
 * large size on a meal's headline is saffron in both modes: large text reads well in the deeper light
 * saffron, and without the dot the number sits in the same place whatever the theme.
 */
const KCAL_SIZES = { caption: 'text-caption', small: 'text-body-sm', large: 'text-title' } as const

export function Kcal({ value, size = 'small' }: { value: number; size?: keyof typeof KCAL_SIZES }) {
  const large = size === 'large'
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {!large && <Dot color="bg-deficit-ring" />}
      <span>
        <span
          className={`font-semibold ${large ? 'text-deficit-ring' : 'text-koshur-silk dark:text-deficit-ring'} ${KCAL_SIZES[size]}`}
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
export function Amounts({ nutrients, withSodium = false }: { nutrients: Nutrients; withSodium?: boolean }) {
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

/** A thin bar split into protein, carbs and fat by their share of the meal's energy. */
export function MacroBar({ nutrients }: { nutrients: Nutrients }) {
  const share = macroShares(nutrients)
  return (
    <span aria-hidden="true" className="flex h-1.5 overflow-hidden rounded-full bg-koshur-border">
      <span className="block h-full bg-macro-protein" style={{ width: `${share.protein * 100}%` }} />
      <span className="block h-full bg-macro-carb" style={{ width: `${share.carbs * 100}%` }} />
      <span className="block h-full bg-macro-fat" style={{ width: `${share.fat * 100}%` }} />
    </span>
  )
}
