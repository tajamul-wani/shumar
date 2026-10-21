import { describe, expect, it } from 'vitest'
import { MEALS, MEAL_LABELS, defaultMeal, isMeal } from './meals.ts'

const at = (hour: number, minute = 0) => new Date(2026, 9, 21, hour, minute)

describe('meals', () => {
  it('lists the five meals in the order of the day, each with a label', () => {
    expect(MEALS.map((m) => MEAL_LABELS[m])).toEqual(['Breakfast', 'Lunch', 'Evening tea', 'Dinner', 'Snack'])
  })

  it('recognises only the five meal values', () => {
    expect(isMeal('evening_tea')).toBe(true)
    expect(isMeal('brunch')).toBe(false)
    expect(isMeal(undefined)).toBe(false)
  })

  it.each([
    [at(0, 30), 'breakfast'],
    [at(10, 59), 'breakfast'],
    [at(11), 'lunch'],
    [at(15, 59), 'lunch'],
    [at(16), 'evening_tea'],
    [at(18, 59), 'evening_tea'],
    [at(19), 'dinner'],
    [at(23, 59), 'dinner'],
  ])('opens on the right meal at %s', (time, meal) => {
    expect(defaultMeal(time)).toBe(meal)
  })
})
