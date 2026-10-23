/**
 * Nutrition math. All food values are stored per 100 g of the food as eaten;
 * household units (piece, cup, katori) are only conversions to grams.
 */

export interface Nutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
  sodiumMg: number
}

export interface FoodUnit {
  name: string
  grams: number
}

export const GRAM: FoodUnit = { name: 'g', grams: 1 }

const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, sodiumMg: 0 }

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a number greater than 0, got ${value}`)
  }
}

/** Grams eaten for a quantity of a unit, e.g. 2 pieces of 80 g = 160 g. */
export function gramsFor(quantity: number, unit: FoodUnit): number {
  assertPositive(quantity, 'Quantity')
  assertPositive(unit.grams, `Weight of one ${unit.name}`)
  return quantity * unit.grams
}

/** Nutrients for a given weight, from per-100 g values. Full precision; round only for display. */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  assertPositive(grams, 'Grams')
  const factor = grams / 100
  return {
    kcal: per100g.kcal * factor,
    protein: per100g.protein * factor,
    carbs: per100g.carbs * factor,
    fat: per100g.fat * factor,
    sodiumMg: per100g.sodiumMg * factor,
  }
}

/** Totals across several logged items. */
export function sumNutrients(items: readonly Nutrients[]): Nutrients {
  return items.reduce<Nutrients>(
    (total, n) => ({
      kcal: total.kcal + n.kcal,
      protein: total.protein + n.protein,
      carbs: total.carbs + n.carbs,
      fat: total.fat + n.fat,
      sodiumMg: total.sodiumMg + n.sodiumMg,
    }),
    ZERO,
  )
}

/** Energy per gram: 4 kcal for protein and carbs, 9 kcal for fat. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const

/** Open Food Facts reports sodium in grams; Shumār stores milligrams. */
export function sodiumGramsToMg(grams: number): number {
  return grams * 1000
}

/** Energy implied by the macros. */
export function atwaterKcal(n: Pick<Nutrients, 'protein' | 'carbs' | 'fat'>): number {
  return KCAL_PER_GRAM.protein * n.protein + KCAL_PER_GRAM.carbs * n.carbs + KCAL_PER_GRAM.fat * n.fat
}

/**
 * Sanity check for incoming food data: the stated kcal should be within
 * the tolerance of the energy implied by the macros. Fibre and alcohol
 * explain some gaps, so the default tolerance is 20%.
 */
export function passesAtwaterCheck(n: Nutrients, tolerance = 0.2): boolean {
  const implied = atwaterKcal(n)
  if (n.kcal === 0 && implied === 0) return true
  if (n.kcal <= 0) return false
  return Math.abs(implied - n.kcal) / n.kcal <= tolerance
}

/** Display rounding: whole kcal and mg, macros to one decimal place. */
export function roundForDisplay(n: Nutrients): Nutrients {
  const oneDecimal = (v: number) => Math.round(v * 10) / 10
  return {
    kcal: Math.round(n.kcal),
    protein: oneDecimal(n.protein),
    carbs: oneDecimal(n.carbs),
    fat: oneDecimal(n.fat),
    sodiumMg: Math.round(n.sodiumMg),
  }
}
