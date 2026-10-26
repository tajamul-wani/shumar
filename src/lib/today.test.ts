import { describe, expect, it } from 'vitest'
import { parseLoggedFood, type LoggedFood } from './dayLogs.ts'
import {
  SODIUM_LIMIT_MG,
  groupMealFoods,
  reviewTitle,
  ringState,
  sodiumAlert,
  summarizeDay,
  furthestBehind,
} from './today.ts'

// Made-up logs with easy numbers for checking the maths, not nutrition data.
function log(id: string, meal: string, name: string, at: string, kcal: number, sodiumMg = 0): LoggedFood {
  return parseLoggedFood({
    id,
    log_date: '2026-10-21',
    logged_at: `2026-10-21T${at}:00+05:30`,
    meal,
    food_name: name,
    food_source: 'usda',
    // The same food always has the same source id, as in real data.
    food_source_id: name,
    quantity: 1,
    unit_name: 'g',
    grams: 100,
    kcal,
    protein: 1,
    carbs: 2,
    fat: 3,
    sodium_mg: sodiumMg,
  }) as LoggedFood
}

const day = [
  log('3', 'dinner', 'Test rice', '20:45', 200),
  log('1', 'breakfast', 'Test tea', '08:10', 45, 600),
  log('2', 'breakfast', 'Test bread', '08:05', 240, 300),
  log('4', 'breakfast', 'Test tea', '09:00', 45, 600),
]

describe('summarizeDay', () => {
  it('groups foods by meal in the order of the day, oldest first, skipping empty meals', () => {
    const { meals } = summarizeDay(day)
    expect(meals.map((m) => m.meal)).toEqual(['breakfast', 'dinner'])
    expect(meals[0].foods.map((f) => f.id)).toEqual(['2', '1', '4'])
    expect(meals[0].firstLoggedAt).toBe('2026-10-21T08:05:00+05:30')
    expect(meals[0].totals.kcal).toBe(330)
  })

  it('adds up the whole day', () => {
    expect(summarizeDay(day).totals).toEqual({ kcal: 530, protein: 4, carbs: 8, fat: 12, sodiumMg: 1500 })
  })

  it("lists the person's own meals after the fixed ones, in the order they were first logged", () => {
    const { meals } = summarizeDay([
      ...day,
      log('6', 'Late bite', 'Test nuts', '23:00', 100),
      log('5', 'Chai', 'Test biscuit', '17:00', 60),
      log('7', 'Chai', 'Test chai', '17:05', 40),
    ])
    expect(meals.map((m) => m.meal)).toEqual(['breakfast', 'dinner', 'Chai', 'Late bite'])
    expect(meals[2].foods.map((f) => f.id)).toEqual(['5', '7'])
    expect(meals[2].totals.kcal).toBe(100)
  })

  it('gives zeros and no meals for an empty day', () => {
    expect(summarizeDay([])).toEqual({
      totals: { kcal: 0, protein: 0, carbs: 0, fat: 0, sodiumMg: 0 },
      meals: [],
    })
  })
})

describe('groupMealFoods', () => {
  it('joins the same food in the same amount into one row, with their values together', () => {
    const rows = groupMealFoods(summarizeDay(day).meals[0].foods)
    expect(rows.map((row) => row.logs.map((l) => l.id))).toEqual([['2'], ['1', '4']])
    expect(rows[1].totals.kcal).toBe(90)
    expect(rows[1].totals.sodiumMg).toBe(1200)
  })

  it('keeps a different amount or unit on its own row', () => {
    const tea = log('1', 'breakfast', 'Test tea', '08:10', 45)
    const bigger = { ...log('2', 'breakfast', 'Test tea', '08:20', 90), quantity: 2 }
    const inCups = { ...log('3', 'breakfast', 'Test tea', '08:30', 45), unitName: 'cup' }
    expect(groupMealFoods([tea, bigger, inCups]).map((row) => row.logs.length)).toEqual([1, 1, 1])
  })

  it('orders rows by when each food was first logged', () => {
    const later = log('9', 'breakfast', 'Test bread', '10:00', 240)
    const rows = groupMealFoods([later, ...summarizeDay(day).meals[0].foods])
    expect(rows.map((row) => row.logs[0].foodName)).toEqual(['Test bread', 'Test tea'])
    expect(rows[0].logs.map((l) => l.id)).toEqual(['2', '9'])
  })
})

describe('sodiumAlert', () => {
  it('stays quiet up to the WHO limit of 2,000 mg', () => {
    expect(SODIUM_LIMIT_MG).toBe(2000)
    expect(sodiumAlert(day)).toBeNull()
    expect(sodiumAlert([...day, log('5', 'lunch', 'Test pickle', '13:00', 10, 500)])).toBeNull()
  })

  it('names the food that gave the most once the day passes it', () => {
    const salty = [...day, log('5', 'lunch', 'Test pickle', '13:00', 10, 1000)]
    // Tea gave 1,200 mg over two cups, more than the pickle's 1,000 mg.
    expect(sodiumAlert(salty)).toEqual({ totalMg: 2500, mostFrom: 'Test tea' })
  })
})

describe('ringState', () => {
  it('shows what was eaten when there is no target', () => {
    expect(ringState(1176.6)).toEqual({ kind: 'eaten', eaten: 1177 })
    expect(ringState(500, 0)).toEqual({ kind: 'eaten', eaten: 500 })
  })

  it('shows what is left under the target', () => {
    expect(ringState(1177, 2100)).toEqual({
      kind: 'left',
      eaten: 1177,
      target: 2100,
      left: 923,
      progress: 1177 / 2100,
    })
  })

  it('shows how far over the target the day is', () => {
    expect(ringState(2300, 2100)).toEqual({ kind: 'over', eaten: 2300, target: 2100, over: 200, progress: 1 })
  })
})

describe('reviewTitle', () => {
  it('follows the time of day', () => {
    expect(reviewTitle(new Date(2026, 9, 21, 9))).toEqual({ title: 'Morning review', evening: false })
    expect(reviewTitle(new Date(2026, 9, 21, 13))).toEqual({ title: 'Afternoon review', evening: false })
    expect(reviewTitle(new Date(2026, 9, 21, 20))).toEqual({ title: 'Evening review', evening: true })
  })
})

describe('furthestBehind', () => {
  const targets = { protein: 100, carbs: 200, fat: 50 }

  it('finds the macro with the smallest share of its target eaten', () => {
    expect(furthestBehind({ protein: 50, carbs: 40, fat: 40 }, targets)).toEqual({
      key: 'carbs',
      eaten: 40,
      target: 200,
    })
  })

  it('picks protein, then carbs, when shares are equal', () => {
    expect(furthestBehind({ protein: 10, carbs: 20, fat: 5 }, targets)?.key).toBe('protein')
  })

  it('gives nothing once every target is met', () => {
    expect(furthestBehind({ protein: 100, carbs: 250, fat: 50 }, targets)).toBeNull()
  })

  it('skips a macro with no target', () => {
    expect(furthestBehind({ protein: 0, carbs: 10, fat: 10 }, { ...targets, protein: 0 })?.key).toBe('carbs')
  })
})
