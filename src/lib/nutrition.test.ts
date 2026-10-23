import { describe, expect, it } from 'vitest'
import { GRAM, gramsFor, roundForDisplay, scaleNutrients, sumNutrients, type Nutrients } from './nutrition.ts'

// Test fixture only, not real food data.
const per100g: Nutrients = { kcal: 300, protein: 10, carbs: 50, fat: 6, sodiumMg: 400 }

describe('gramsFor', () => {
  it('converts household units to grams', () => {
    expect(gramsFor(2, { name: 'piece', grams: 80 })).toBe(160)
    expect(gramsFor(0.5, { name: 'katori', grams: 120 })).toBe(60)
  })

  it('treats grams as a unit of 1 g', () => {
    expect(gramsFor(250, GRAM)).toBe(250)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects a quantity of %s', (q) => {
    expect(() => gramsFor(q, GRAM)).toThrow(RangeError)
  })

  it('rejects a unit with no weight', () => {
    expect(() => gramsFor(1, { name: 'cup', grams: 0 })).toThrow(/Weight of one cup/)
  })
})

describe('scaleNutrients', () => {
  it('returns the stored values for exactly 100 g', () => {
    expect(scaleNutrients(per100g, 100)).toEqual(per100g)
  })

  it('scales every nutrient by weight', () => {
    const scaled = scaleNutrients(per100g, 160)
    expect(scaled.kcal).toBeCloseTo(480)
    expect(scaled.protein).toBeCloseTo(16)
    expect(scaled.carbs).toBeCloseTo(80)
    expect(scaled.fat).toBeCloseTo(9.6)
    expect(scaled.sodiumMg).toBeCloseTo(640)
  })

  it('keeps full precision for small amounts', () => {
    expect(scaleNutrients(per100g, 1).fat).toBeCloseTo(0.06)
  })

  it('rejects zero or negative weights', () => {
    expect(() => scaleNutrients(per100g, 0)).toThrow(RangeError)
    expect(() => scaleNutrients(per100g, -5)).toThrow(RangeError)
  })
})

describe('sumNutrients', () => {
  it('adds up several items', () => {
    const a: Nutrients = { kcal: 90, protein: 2, carbs: 6, fat: 6, sodiumMg: 500 }
    const b: Nutrients = { kcal: 240, protein: 7, carbs: 43, fat: 4, sodiumMg: 300 }
    expect(sumNutrients([a, b])).toEqual({ kcal: 330, protein: 9, carbs: 49, fat: 10, sodiumMg: 800 })
  })

  it('returns zeros for an empty day', () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0, sodiumMg: 0 })
  })
})

describe('roundForDisplay', () => {
  it('rounds kcal and sodium to whole numbers and macros to one decimal', () => {
    expect(
      roundForDisplay({ kcal: 487.3, protein: 12.345, carbs: 60.06, fat: 9.94, sodiumMg: 401.6 }),
    ).toEqual({ kcal: 487, protein: 12.3, carbs: 60.1, fat: 9.9, sodiumMg: 402 })
  })
})
