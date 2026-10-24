import { describe, expect, it } from 'vitest'
import { EXAMPLE_FOOD, EXAMPLE_PROFILE, exampleServing, exampleSteps } from './homeExample.ts'
import { roundForDisplay } from './nutrition.ts'
import { dailyTargets } from './targets.ts'

describe('the home page example', () => {
  it('walks from the formula to the same targets the app would set', () => {
    const { steps, targets } = exampleSteps()
    expect(targets).toEqual(dailyTargets(EXAMPLE_PROFILE))
    expect(steps.map((s) => s.result)).toEqual([
      '1,749 kcal at rest',
      '2,676 kcal to stay the same',
      '2,176 kcal a day',
      '128 g',
      '60 g',
      '280 g',
    ])
    expect(steps[0].working).toBe('10 × 80 kg + 6.25 × 175 cm − 5 × 30 years + 5')
    expect(steps.map((s) => s.tone)).toEqual([null, null, 'kcal', 'protein', 'fat', 'carbs'])
  })

  it('scales the USDA egg from its per-100 g values', () => {
    expect(EXAMPLE_FOOD.source).toContain('171287')
    const one = exampleServing(1)
    expect(one.grams).toBe(50)
    expect(roundForDisplay(one.nutrients)).toMatchObject({ kcal: 72, protein: 6.3 })
    const five = exampleServing(5)
    expect(five.grams).toBe(250)
    expect(roundForDisplay(five.nutrients)).toMatchObject({ kcal: 358, protein: 31.4, carbs: 1.8, fat: 23.8 })
  })
})
