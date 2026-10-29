import { describe, expect, it } from 'vitest'
import {
  amountLabel,
  amountWithGrams,
  defaultQuantity,
  defaultUnit,
  formatNumber,
  isEstimate,
  nutrientsFor,
  parseDecimal,
  parseQuantity,
  quantityStep,
  showsVerified,
  shortUnitName,
  sourceTag,
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

  it('tags a food only where the tag says something', () => {
    expect(sourceTag(food())).toBeNull()
    expect(sourceTag(food({ flagged: true }))).toBe('Estimate')
    expect(sourceTag(food({ source: 'kashmiri' }))).toBe('Kashmiri')
    expect(sourceTag(food({ source: 'kashmiri', verified: false }))).toBe('Estimate')
    expect(sourceTag(food({ source: 'mine' }))).toBe('Yours')
    expect(sourceTag(food({ source: 'mine', flagged: true }))).toBe('Yours')
  })
})

describe('units and amounts', () => {
  it('starts a weighed USDA food on grams, and one eaten whole on one of a usual size', () => {
    expect(defaultUnit(food())).toEqual(g)
    const sizes = [
      g,
      { name: '1 small', grams: 38 },
      { name: '1 medium', grams: 44 },
      { name: '1 large', grams: 50 },
    ]
    expect(defaultUnit(food({ name: 'Test banana, raw', units: sizes }))).toEqual({
      name: '1 medium',
      grams: 44,
    })
    expect(defaultUnit(food({ name: 'Egg, whole, raw', units: sizes }))).toEqual({
      name: '1 large',
      grams: 50,
    })
    // The description in brackets doesn't stop a size being found.
    const long = { name: '1 medium (7" to 7-7/8" long)', grams: 118 }
    expect(defaultUnit(food({ units: [g, { name: '1 cup', grams: 150 }, long] }))).toEqual(long)
    expect(defaultUnit(food({ units: [g, { name: '1 small', grams: 38 }] }))).toEqual({
      name: '1 small',
      grams: 38,
    })
    const tomato = { name: '1 medium whole (2-3/5" dia)', grams: 123 }
    expect(defaultUnit(food({ units: [g, { name: '1 slice', grams: 20 }, tomato] }))).toEqual(tomato)
  })

  it('starts on one item when USDA has a unit for it and no size', () => {
    const shelled = { name: '1 egg, whole without shell', grams: 50 }
    expect(defaultUnit(food({ name: 'Eggs, Grade A, Large, egg whole', units: [g, shelled] }))).toEqual(
      shelled,
    )
    const date = { name: '1 date, pitted', grams: 24 }
    expect(defaultUnit(food({ name: 'Dates, medjool', units: [g, date] }))).toEqual(date)
    const orange = { name: '1 fruit (2-5/8" dia)', grams: 131 }
    const units = [g, { name: '1 cup, sections', grams: 180 }, orange, { name: '1 large', grams: 184 }]
    expect(defaultUnit(food({ name: 'Oranges, raw', units }))).toEqual(orange)
    // A cup is not one item, and neither is another food's name.
    expect(defaultUnit(food({ name: 'Test rice', units: [g, { name: '1 date', grams: 8 }] }))).toEqual(g)
  })

  it('starts on grams when one piece is more than a serving, or is the juice of a fruit', () => {
    const melon = [g, { name: '1 melon (5-1/4" dia)', grams: 1000 }, { name: '1 large', grams: 1400 }]
    expect(defaultUnit(food({ name: 'Melons, honeydew, raw', units: melon }))).toEqual(g)
    expect(defaultUnit(food({ name: 'Test pie', units: [g, { name: '1 pie', grams: 1137 }] }))).toEqual(g)
    const juice = [g, { name: '1 fruit yields', grams: 86 }]
    expect(defaultUnit(food({ name: 'Orange juice, raw', units: juice }))).toEqual(g)
  })

  it("starts our own dishes and a person's own foods on their first unit, otherwise grams", () => {
    expect(defaultUnit(food({ source: 'kashmiri', units: [g, katori] }))).toEqual(katori)
    expect(defaultUnit(food({ source: 'mine', units: [g, { name: '1 serving', grams: 30 }] }))).toEqual({
      name: '1 serving',
      grams: 30,
    })
    expect(defaultUnit(food({ source: 'mine', units: [g] }))).toEqual(g)
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
    [2, cup, '2 cups, chopped'],
    [2, { name: '1 large', grams: 50 }, '2 large'],
    [1, { name: '1 medium (7" to 7-7/8" long)', grams: 118 }, '1 medium'],
    [3, { name: '1 slice', grams: 28 }, '3 slices'],
    [2, { name: '1 NLEA serving', grams: 126 }, '2 × NLEA serving'],
    [2, { name: '0.5 cup', grams: 80 }, '2 × 0.5 cup'],
  ])('reads %s of %o as "%s"', (quantity, unit, label) => {
    expect(amountLabel(quantity, unit)).toBe(label)
  })

  it('gives the weight with the amount, and drops the description in brackets', () => {
    expect(amountWithGrams(2, { name: '1 large', grams: 50 })).toBe('2 large (100 g)')
    expect(amountWithGrams(150, g)).toBe('150 g')
    expect(amountWithGrams(1.5, katori)).toBe('1.5 katori (180 g)')
    expect(shortUnitName('1 medium (3" dia)')).toBe('1 medium')
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

describe('parseDecimal', () => {
  it('reads zero too, for a label that gives 0 g of something', () => {
    expect(parseDecimal('0')).toBe(0)
    expect(parseDecimal('0,5')).toBe(0.5)
    expect(parseDecimal('-1')).toBeNull()
    expect(parseDecimal('')).toBeNull()
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
