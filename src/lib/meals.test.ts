import { describe, expect, it } from 'vitest'
import {
  MEALS,
  MEAL_LABELS,
  defaultMeal,
  isMeal,
  mealLabel,
  mealPhrase,
  normalizeMealName,
  sortMeals,
} from './meals.ts'

const at = (hour: number, minute = 0) => new Date(2026, 9, 21, hour, minute)

describe('meals', () => {
  it('lists the five fixed meals in the order of the day, each with a label', () => {
    expect(MEALS.map((m) => MEAL_LABELS[m])).toEqual(['Breakfast', 'Lunch', 'Evening tea', 'Dinner', 'Snack'])
  })

  it('accepts the fixed meals and short names of your own, as the database does', () => {
    expect(isMeal('evening_tea')).toBe(true)
    expect(isMeal('Chai')).toBe(true)
    expect(isMeal('m'.repeat(30))).toBe(true)
    expect(isMeal('m'.repeat(31))).toBe(false)
    expect(isMeal('')).toBe(false)
    expect(isMeal(' Chai')).toBe(false)
    expect(isMeal('Chai\ntime')).toBe(false)
    expect(isMeal(undefined)).toBe(false)
  })

  it('shows a fixed meal by its label and your own meal as you typed it', () => {
    expect(mealLabel('evening_tea')).toBe('Evening tea')
    expect(mealLabel('Chai')).toBe('Chai')
    expect(mealPhrase('evening_tea')).toBe('evening tea')
    expect(mealPhrase('Chai')).toBe('Chai')
  })

  it('tidies a typed meal name and turns a fixed label back into its key', () => {
    expect(normalizeMealName('  Pre   workout ')).toBe('Pre workout')
    expect(normalizeMealName('Evening Tea')).toBe('evening_tea')
    expect(normalizeMealName('lunch')).toBe('lunch')
    expect(normalizeMealName('   ')).toBeNull()
    expect(normalizeMealName('m'.repeat(31))).toBeNull()
  })

  it('puts the fixed meals first, in the order of the day, then your own in the order given', () => {
    const items = ['Chai', 'dinner', 'Late bite', 'breakfast']
    expect(sortMeals(items, (m) => m)).toEqual(['breakfast', 'dinner', 'Chai', 'Late bite'])
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
