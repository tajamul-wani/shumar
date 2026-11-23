import type { FoodResult, FoodUnit } from './foodSearch.ts'
import type { FoodAmount } from './logs.ts'
import {
  NO_MINERALS,
  gramsFor,
  roundForDisplay,
  scaleMinerals,
  scaleNutrients,
  type Minerals,
  type Nutrients,
} from './nutrition.ts'

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

/**
 * The small tag on a food in a list, only where it says something: a person's own food, a dish from
 * our Kashmiri catalog, or values to treat as an estimate. A USDA food needs none.
 */
export function sourceTag(food: FoodResult): string | null {
  if (food.source === 'mine') return 'Yours'
  if (isEstimate(food)) return 'Estimate'
  return food.source === 'kashmiri' ? 'Kashmiri' : null
}

/** USDA's sizes for a food eaten whole ("1 large"), after the usual one. */
const OTHER_SIZES = ['large', 'small', 'extra large', 'jumbo', 'extra small', 'medium']

/** A whole melon, pie or chicken is more than one serving: a food whose piece is heavier starts on grams. */
const MAX_PIECE_GRAMS = 250

/**
 * USDA's unit for one whole item, when it has one: "1 fruit", "1 each", or one of the food itself,
 * as in "1 egg, whole without shell" for Eggs or "1 date, pitted" for Dates.
 */
function wholeItem(food: FoodResult, pieces: readonly FoodUnit[]): FoodUnit | undefined {
  const word = /^[a-z]+/i.exec(food.name)?.[0].toLowerCase() ?? ''
  const names = ['fruit', 'each', word, word.replace(/s$/, ''), word.replace(/es$/, '')].filter(Boolean)
  return pieces.find((unit) => {
    const counted = /^1 ([a-z]+)\b/i.exec(shortUnitName(unit.name))
    return counted !== null && names.includes(counted[1].toLowerCase())
  })
}

/**
 * The unit a food starts on. A USDA food eaten whole (an egg, a banana, an apple) starts on one
 * piece of up to 250 g: the usual size (an egg is large, as USDA's reference egg and most eggs
 * sold are; a fruit is medium), else its unit for one item, else another size. Any other USDA food
 * starts on grams, as most are weighed. Our own dishes and a person's own foods start on their
 * first unit (a katori, a piece, a serving), or grams.
 */
export function defaultUnit(food: FoodResult): FoodUnit {
  const grams = food.units[0]
  if (food.source !== 'usda') return food.units.find((unit) => unit.name !== 'g') ?? grams
  // "1 fruit yields" is the juice from one fruit, not the fruit.
  const pieces = food.units.filter((unit) => unit.grams <= MAX_PIECE_GRAMS && !/\byields?\b/i.test(unit.name))
  const sized = (size: string) =>
    pieces.find((unit) => shortUnitName(unit.name).replace(/ whole$/, '') === `1 ${size}`)
  const usual = /^eggs?\b/i.test(food.name) ? 'large' : 'medium'
  return sized(usual) ?? wholeItem(food, pieces) ?? OTHER_SIZES.map(sized).find(Boolean) ?? grams
}

export function defaultQuantity(unit: FoodUnit): number {
  if (unit.name === 'g' || unit.name === 'ml') return 100
  if (unit.name === 'l') return 1
  return 1
}

/** The + and - buttons move by 10 g / ml, 0.25 l, or by half a unit (half a katori is common). */
export function quantityStep(unit: FoodUnit): number {
  if (unit.name === 'g' || unit.name === 'ml') return 10
  if (unit.name === 'l') return 0.25
  return 0.5
}

const LIQUID_PATTERNS =
  /\b(milk|chai|tea|coffee|juice|water|oil|soup|broth|soda|drink|beverage|lassi|kahwa|syrup|vinegar)\b/i

export function isLiquid(name: string): boolean {
  return LIQUID_PATTERNS.test(name)
}

/**
 * The units available to choose for a food in the log popup: household portions first,
 * then grams, and millilitres / litres for liquids and custom foods.
 */
export function availableUnits(food: FoodResult): FoodUnit[] {
  const units = [...food.units]
  const hasGrams = units.some((u) => u.name === 'g')
  const hasMl = units.some((u) => u.name === 'ml')
  const hasL = units.some((u) => u.name === 'l')
  if (!hasGrams) units.push({ name: 'g', grams: 1 })
  if (!hasMl && (food.source === 'mine' || isLiquid(food.name))) {
    units.push({ name: 'ml', grams: 1 })
  }
  if (!hasL && (food.source === 'mine' || isLiquid(food.name))) {
    units.push({ name: 'l', grams: 1000 })
  }
  return [
    ...units.filter((u) => u.name !== 'g' && u.name !== 'ml' && u.name !== 'l'),
    ...units.filter((u) => u.name === 'g' || u.name === 'ml' || u.name === 'l'),
  ]
}

const startsWithAmount = (name: string) => /^\d/.test(name)

/** A unit's name without the description in brackets: "1 medium (7\" to 7-7/8\" long)" is "1 medium". */
export function shortUnitName(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, '').trim()
}

/** Household units that come up, with their plurals, for "2 cups". A size such as large stays as it is. */
const PLURALS: Record<string, string> = {
  bowl: 'bowls',
  cup: 'cups',
  egg: 'eggs',
  fruit: 'fruits',
  glass: 'glasses',
  piece: 'pieces',
  serving: 'servings',
  slice: 'slices',
}

/**
 * How much, in plain words: "100 g", "100 ml", "1 large", "2 large", "2 cups, chopped", "2 katori". USDA
 * names a portion with its count ("1 large"), so a count of them reads "2 large", never "2 × 1 large".
 */
export function amountLabel(quantity: number, unit: FoodUnit): string {
  const amount = formatNumber(quantity)
  if (unit.name === 'g') return `${amount} g`
  if (unit.name === 'ml') return `${amount} ml`
  if (unit.name === 'l') return `${amount} l`
  const name = shortUnitName(unit.name)
  const counted = /^1 (.+)$/.exec(name)
  if (!counted) return startsWithAmount(name) ? `${amount} × ${name}` : `${amount} ${name}`
  if (quantity === 1) return name
  const rest = counted[1]
  if (/^(extra small|small|medium|large|extra large|jumbo)\b/.test(rest)) return `${amount} ${rest}`
  const [, word, after] = /^([a-z]+)(.*)$/i.exec(rest) ?? [rest, rest, '']
  const plural = PLURALS[word.toLowerCase()]
  return plural ? `${amount} ${plural}${after}` : `${amount} × ${rest}`
}

/** The amount with its weight: "2 large (100 g)", or just "150 g" when it is weighed in grams. */
export function amountWithGrams(quantity: number, unit: FoodUnit): string {
  if (unit.name === 'g' || unit.name === 'ml') return amountLabel(quantity, unit)
  return `${amountLabel(quantity, unit)} (${formatNumber(Math.round(gramsFor(quantity, unit)))} g)`
}

/** "1 katori is 120 g" or "1 cup, chopped is 160 g". Nothing for grams or ml. */
export function unitHint(unit: FoodUnit): string | null {
  if (unit.name === 'g' || unit.name === 'ml') return null
  if (unit.name === 'l') return '1 l is 1,000 ml'
  const grams = formatNumber(Math.round(unit.grams * 10) / 10)
  return startsWithAmount(unit.name) ? `${unit.name} is ${grams} g` : `1 ${unit.name} is ${grams} g`
}

/** Rounded for display, or null when the amount can't be used. */
export function nutrientsFor(food: FoodResult, quantity: number, unit: FoodUnit): Nutrients | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  return roundForDisplay(scaleNutrients(food.per100g, gramsFor(quantity, unit)))
}

/** One row of the vitamins and minerals list: a name, and its amount or null where it is not listed. */
export interface MineralRow {
  label: string
  /** For example "50 mg", or null for not listed. */
  value: string | null
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10

/**
 * Calcium, magnesium and vitamin D for an amount of a food, then sodium, for the list under the
 * macros. A value the food does not list is null, never a zero. Null for an amount that can't be used.
 */
export function mineralRows(food: FoodResult, quantity: number, unit: FoodUnit): MineralRow[] | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  const grams = gramsFor(quantity, unit)
  const minerals: Minerals = scaleMinerals(food.minerals ?? NO_MINERALS, grams)
  const sodium = Math.round(scaleNutrients(food.per100g, grams).sodiumMg)
  const mg = (value: number | null) => (value === null ? null : `${formatNumber(Math.round(value))} mg`)
  return [
    { label: 'Calcium', value: mg(minerals.calciumMg) },
    { label: 'Magnesium', value: mg(minerals.magnesiumMg) },
    {
      label: 'Vitamin D',
      value: minerals.vitaminDMcg === null ? null : `${formatNumber(oneDecimal(minerals.vitaminDMcg))} mcg`,
    },
    { label: 'Sodium', value: food.sodiumListed === false ? null : `${formatNumber(sodium)} mg` },
  ]
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
