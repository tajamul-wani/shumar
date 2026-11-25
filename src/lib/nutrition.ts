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
  fiberG?: number
}

/**
 * Essential vitamins and minerals. null is "not listed": a food whose
 * source gives no value, never a zero.
 */
export interface Minerals {
  calciumMg: number | null
  magnesiumMg: number | null
  vitaminDMcg: number | null
  ironMg?: number | null
  potassiumMg?: number | null
  zincMg?: number | null
  vitaminB12Mcg?: number | null
  vitaminCMg?: number | null
  vitaminAMcg?: number | null
  folateMcg?: number | null
}

export const NO_MINERALS: Minerals = {
  calciumMg: null,
  magnesiumMg: null,
  vitaminDMcg: null,
  ironMg: null,
  potassiumMg: null,
  zincMg: null,
  vitaminB12Mcg: null,
  vitaminCMg: null,
  vitaminAMcg: null,
  folateMcg: null,
}

export interface FoodUnit {
  name: string
  grams: number
}

export const GRAM: FoodUnit = { name: 'g', grams: 1 }

const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, sodiumMg: 0, fiberG: 0 }

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
    fiberG: per100g.fiberG !== undefined ? per100g.fiberG * factor : undefined,
  }
}

/** The values for a given weight, from per-100 g values. Not listed stays not listed. */
export function scaleMinerals(per100g: Minerals, grams: number): Minerals {
  assertPositive(grams, 'Grams')
  const scale = (value: number | null | undefined) =>
    value === null || value === undefined ? null : (value * grams) / 100
  return {
    calciumMg: scale(per100g.calciumMg),
    magnesiumMg: scale(per100g.magnesiumMg),
    vitaminDMcg: scale(per100g.vitaminDMcg),
    ironMg: scale(per100g.ironMg),
    potassiumMg: scale(per100g.potassiumMg),
    zincMg: scale(per100g.zincMg),
    vitaminB12Mcg: scale(per100g.vitaminB12Mcg),
    vitaminCMg: scale(per100g.vitaminCMg),
    vitaminAMcg: scale(per100g.vitaminAMcg),
    folateMcg: scale(per100g.folateMcg),
  }
}

/**
 * Sums minerals across several foods in a meal.
 * Returns null for a nutrient if no food in the meal listed it.
 * If at least one food listed it, returns the sum of listed amounts.
 */
export function sumMinerals(items: readonly (Minerals | null | undefined)[]): Minerals {
  const addKey = (key: keyof Minerals) => {
    let hasValue = false
    let sum = 0
    for (const item of items) {
      if (!item) continue
      const val = item[key]
      if (val !== null && val !== undefined) {
        hasValue = true
        sum += val
      }
    }
    return hasValue ? sum : null
  }

  return {
    calciumMg: addKey('calciumMg'),
    magnesiumMg: addKey('magnesiumMg'),
    vitaminDMcg: addKey('vitaminDMcg'),
    ironMg: addKey('ironMg'),
    potassiumMg: addKey('potassiumMg'),
    zincMg: addKey('zincMg'),
    vitaminB12Mcg: addKey('vitaminB12Mcg'),
    vitaminCMg: addKey('vitaminCMg'),
    vitaminAMcg: addKey('vitaminAMcg'),
    folateMcg: addKey('folateMcg'),
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
      fiberG: (total.fiberG ?? 0) + (n.fiberG ?? 0),
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
    fiberG: n.fiberG !== undefined ? oneDecimal(n.fiberG) : undefined,
  }
}
