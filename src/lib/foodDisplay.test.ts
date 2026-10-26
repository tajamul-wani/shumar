import { describe, expect, it } from 'vitest'
import {
  amountLabel,
  defaultQuantity,
  defaultUnit,
  formatNumber,
  isEstimate,
  nutrientsFor,
  parseQuantity,
  quantityStep,
  showsVerified,
  sourceLabel,
  unitHint,
  foodsLine,
  totalKcal,
} from './foodDisplay.ts'
import type { FoodResult } from './foodSearch.ts'

// Made-up foods for testing the wording and maths, not nutrition data.
function food(overrides: Partial<FoodResult> = {}): FoodResult {
  return {
    source: 'usda',
    sourceId: '1',
    name: 'Test rice, cooked',
    per100g: { kcal: 130, protein: 2.5, carbs: 28, fat: 0.3, sodiumMg: 1 },
    units: [
      { name: 'g', grams: 1 },
      { name: '1 cup', grams: 160 },
    ],
    flagged: false,
    verified: true,
    ...overrides,
  }
}

const g = { name: 'g', grams: 1 }
const katori = { name: 'katori', grams: 120 }
const cup = { name: '1 cup, chopped', grams: 160 }

describe('estimates and sources', () => {
  it('treats flagged values and unconfirmed Kashmiri dishes as estimates', () => {
    expect(isEstimate(food())).toBe(false)
    expect(isEstimate(food({ flagged: true }))).toBe(true)
    expect(isEstimate(food({ source: 'kashmiri', verified: false }))).toBe(true)
    expect(isEstimate(food({ source: 'kashmiri', verified: true }))).toBe(false)
  })

  it('marks only confirmed Kashmiri dishes as Verified', () => {
    expect(showsVerified(food({ source: 'kashmiri', verified: true }))).toBe(true)
    expect(showsVerified(food({ source: 'kashmiri', verified: true, flagged: true }))).toBe(false)
    expect(showsVerified(food({ source: 'kashmiri', verified: false }))).toBe(false)
    expect(showsVerified(food())).toBe(false)
  })

  it('names the source the way the design does', () => {
    expect(sourceLabel(food())).toBe('Ingredient')
    expect(sourceLabel(food({ source: 'kashmiri' }))).toBe('Kashmiri')
  })
})

describe('units and amounts', () => {
  it('starts on a household unit when there is one, otherwise grams', () => {
    expect(defaultUnit(food())).toEqual({ name: '1 cup', grams: 160 })
    expect(defaultUnit(food({ units: [g] }))).toEqual(g)
  })

  it('starts on 100 g or 1 unit, and steps by 10 g or half a unit', () => {
    expect([defaultQuantity(g), defaultQuantity(katori)]).toEqual([100, 1])
    expect([quantityStep(g), quantityStep(katori)]).toEqual([10, 0.5])
  })

  it.each([
    [150, g, '150 g'],
    [1, katori, '1 katori'],
    [2.5, katori, '2.5 katori'],
    [1, cup, '1 cup, chopped'],
    [2, cup, '2 × 1 cup, chopped'],
  ])('reads %s of %o as "%s"', (quantity, unit, label) => {
    expect(amountLabel(quantity, unit)).toBe(label)
  })

  it('explains how heavy a unit is', () => {
    expect(unitHint(katori)).toBe('1 katori is 120 g')
    expect(unitHint(cup)).toBe('1 cup, chopped is 160 g')
    expect(unitHint({ name: '1 slice', grams: 28.35 })).toBe('1 slice is 28.4 g')
    expect(unitHint(g)).toBeNull()
  })

  it('formats numbers with Indian grouping and up to two decimals', () => {
    expect(formatNumber(1177)).toBe('1,177')
    expect(formatNumber(0.333)).toBe('0.33')
  })
})

describe('nutrientsFor', () => {
  it('works out and rounds the values for an amount', () => {
    expect(nutrientsFor(food(), 2, { name: '1 cup', grams: 160 })).toEqual({
      kcal: 416,
      protein: 8,
      carbs: 89.6,
      fat: 1,
      sodiumMg: 3,
    })
  })

  it('gives nothing for an amount that cannot be used', () => {
    expect(nutrientsFor(food(), 0, g)).toBeNull()
    expect(nutrientsFor(food(), Number.NaN, g)).toBeNull()
  })
})

describe('parseQuantity', () => {
  it.each([
    ['1', 1],
    [' 2.5 ', 2.5],
    ['.5', 0.5],
    ['0,5', 0.5],
    ['1,000', 1000],
    ['1,250.5', 1250.5],
  ])('reads "%s" as %s', (input, value) => {
    expect(parseQuantity(input)).toBe(value)
  })

  it.each(['', '0', '-1', 'abc', '1.2.3', '1e3', '2 cups'])('refuses "%s"', (input) => {
    expect(parseQuantity(input)).toBeNull()
  })
})

describe('foodsLine and totalKcal', () => {
  // Made-up foods with easy numbers, not nutrition data.
  const tea = {
    foodName: 'Test tea',
    foodSource: 'kashmiri' as const,
    foodSourceId: 'k1',
    quantity: 2,
    unitName: 'cup',
    grams: 300,
    nutrients: { kcal: 90.4, protein: 3, carbs: 9, fat: 4.5, sodiumMg: 600 },
  }
  const bread = {
    ...tea,
    foodName: 'Test bread',
    quantity: 1,
    unitName: 'piece',
    grams: 90,
    nutrients: { ...tea.nutrients, kcal: 320.4 },
  }

  it('lists the foods with their amounts on one line', () => {
    expect(foodsLine([tea, bread])).toBe('Test tea 2 cup, Test bread 1 piece')
    expect(foodsLine([{ ...tea, unitName: 'g', quantity: 150, grams: 150 }])).toBe('Test tea 150 g')
    expect(foodsLine([])).toBe('')
  })

  it('adds the calories up to a whole number', () => {
    expect(totalKcal([tea, bread])).toBe(411)
    expect(totalKcal([])).toBe(0)
  })
})
