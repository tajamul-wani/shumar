import type { FoodResult, FoodUnit } from './foodSearch.ts'
import type { FoodAmount } from './logs.ts'
import { gramsFor, roundForDisplay, scaleNutrients, type Nutrients } from './nutrition.ts'

/**
 * How foods and amounts read in the log sheet. Kept apart from the screens so the wording and
 * the maths can be tested on their own.
 */

const NUMBER = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

export function formatNumber(value: number): string {
  return NUMBER.format(value)
}

/** Values failed the Atwater check, or our own dish isn't confirmed by a second weighing yet. */
export function isEstimate(food: FoodResult): boolean {
  return food.flagged || (food.source === 'kashmiri' && !food.verified)
}

/** Only our own dishes carry a Verified mark: USDA foods are verified by their source. */
export function showsVerified(food: FoodResult): boolean {
  return food.source === 'kashmiri' && food.verified && !food.flagged
}

export function sourceLabel(food: FoodResult): string {
  if (food.source === 'mine') return 'Yours'
  return food.source === 'kashmiri' ? 'Kashmiri' : 'Ingredient'
}

/** The first household unit (cup, katori, piece), or grams when the food has none. */
export function defaultUnit(food: FoodResult): FoodUnit {
  return food.units.find((unit) => unit.name !== 'g') ?? food.units[0]
}

export function defaultQuantity(unit: FoodUnit): number {
  return unit.name === 'g' ? 100 : 1
}

/** The + and - buttons move by 10 g, or by half a unit (half a katori is common). */
export function quantityStep(unit: FoodUnit): number {
  return unit.name === 'g' ? 10 : 0.5
}

const startsWithAmount = (name: string) => /^\d/.test(name)

/** "100 g", "1 katori", "2 katori", "1 cup, chopped" or "2 × 1 cup, chopped". */
export function amountLabel(quantity: number, unit: FoodUnit): string {
  const amount = formatNumber(quantity)
  if (unit.name === 'g') return `${amount} g`
  if (startsWithAmount(unit.name)) return quantity === 1 ? unit.name : `${amount} × ${unit.name}`
  return `${amount} ${unit.name}`
}

/** "1 katori is 120 g" or "1 cup, chopped is 160 g". Nothing for grams. */
export function unitHint(unit: FoodUnit): string | null {
  if (unit.name === 'g') return null
  const grams = formatNumber(Math.round(unit.grams * 10) / 10)
  return startsWithAmount(unit.name) ? `${unit.name} is ${grams} g` : `1 ${unit.name} is ${grams} g`
}

/** Rounded for display, or null when the amount can't be used. */
export function nutrientsFor(food: FoodResult, quantity: number, unit: FoodUnit): Nutrients | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  return roundForDisplay(scaleNutrients(food.per100g, gramsFor(quantity, unit)))
}

/**
 * Reads a number someone typed. Accepts "0.5" and "0,5" (some keyboards give a comma) and
 * "1,000". Returns null for anything that isn't a number of zero or more.
 */
export function parseDecimal(input: string): number | null {
  let text = input.trim().replace(/\s+/g, '')
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, '')
  else if (/^\d*,\d+$/.test(text)) text = text.replace(',', '.')
  if (!/^\d*\.?\d+$/.test(text)) return null
  return Number(text)
}

/** Reads what someone typed as an amount, as parseDecimal does. Returns null unless it is above zero. */
export function parseQuantity(input: string): number | null {
  const value = parseDecimal(input)
  return value !== null && value > 0 ? value : null
}

/** "Nun Chai 2 cups, Girda 1 piece": foods with the amounts they were logged or saved in, on one line. */
export function foodsLine(foods: readonly FoodAmount[]): string {
  return foods
    .map(
      (food) =>
        `${food.foodName} ${amountLabel(food.quantity, { name: food.unitName, grams: food.grams / food.quantity })}`,
    )
    .join(', ')
}

/** What a group of foods adds up to, as whole calories. */
export function totalKcal(foods: readonly FoodAmount[]): number {
  return Math.round(foods.reduce((sum, food) => sum + food.nutrients.kcal, 0))
}
