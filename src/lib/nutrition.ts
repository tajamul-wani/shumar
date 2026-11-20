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

/**
 * Calcium and magnesium in mg and vitamin D in micrograms. null is "not listed": a food whose
 * source gives no value, never a zero. They sit beside the totals and are not added up.
 */
export interface Minerals {
  calciumMg: number | null
  magnesiumMg: number | null
  vitaminDMcg: number | null
}

export const NO_MINERALS: Minerals = { calciumMg: null, magnesiumMg: null, vitaminDMcg: null }

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

/** The three values for a given weight, from per-100 g values. Not listed stays not listed. */
export function scaleMinerals(per100g: Minerals, grams: number): Minerals {
  assertPositive(grams, 'Grams')
  const scale = (value: number | null) => (value === null ? null : (value * grams) / 100)
  return {
    calciumMg: scale(per100g.calciumMg),
    magnesiumMg: scale(per100g.magnesiumMg),
    vitaminDMcg: scale(per100g.vitaminDMcg),
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
