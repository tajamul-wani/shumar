import type { LoggedFood } from './dayLogs.ts'
import { MEALS, type Meal } from './meals.ts'
import { sumNutrients, type Nutrients } from './nutrition.ts'

/** What the Today screen shows, worked out from the day's logs. Kept apart from the screen so it can be tested. */

export interface MealGroup {
  meal: Meal
  foods: LoggedFood[]
  totals: Nutrients
  /** When the first food of this meal was logged, as an ISO timestamp. */
  firstLoggedAt: string
}

export interface DaySummary {
  totals: Nutrients
  /** Only meals with food in them, in the order of the day. */
  meals: MealGroup[]
}

const byTime = (a: LoggedFood, b: LoggedFood) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt)

export function summarizeDay(logs: readonly LoggedFood[]): DaySummary {
  const meals: MealGroup[] = []
  for (const meal of MEALS) {
    const foods = logs.filter((log) => log.meal === meal).sort(byTime)
    if (foods.length === 0) continue
    meals.push({
      meal,
      foods,
      totals: sumNutrients(foods.map((food) => food.nutrients)),
      firstLoggedAt: foods[0].loggedAt,
    })
  }
  return { totals: sumNutrients(logs.map((log) => log.nutrients)), meals }
}

/** The food names in a meal, each once, in the order they were logged. */
export function mealFoodNames(group: MealGroup): string {
  return [...new Set(group.foods.map((food) => food.foodName))].join(' · ')
}

/**
 * The World Health Organization's guideline for adults: less than 2,000 mg of sodium a day
 * ("Guideline: Sodium intake for adults and children", WHO, 2012).
 */
export const SODIUM_LIMIT_MG = 2000

export interface SodiumAlert {
  totalMg: number
  /** The food that gave the most sodium today, counting every time it was logged. */
  mostFrom: string
}

/** An alert once the day's sodium passes the WHO limit, or null below it. */
export function sodiumAlert(logs: readonly LoggedFood[]): SodiumAlert | null {
  const totalMg = sumNutrients(logs.map((log) => log.nutrients)).sodiumMg
  if (totalMg <= SODIUM_LIMIT_MG) return null
  const byFood = new Map<string, number>()
  for (const log of [...logs].sort(byTime)) {
    byFood.set(log.foodName, (byFood.get(log.foodName) ?? 0) + log.nutrients.sodiumMg)
  }
  let mostFrom = ''
  let most = -1
  for (const [name, mg] of byFood) {
    if (mg > most) {
      mostFrom = name
      most = mg
    }
  }
  return { totalMg, mostFrom }
}

export type RingState =
  /** No daily target yet: the ring shows what has been eaten. */
  | { kind: 'eaten'; eaten: number }
  | { kind: 'left'; eaten: number; target: number; left: number; progress: number }
  | { kind: 'over'; eaten: number; target: number; over: number; progress: 1 }

/** The calorie ring for whole kcal eaten against an optional daily target. */
export function ringState(eatenKcal: number, target?: number | null): RingState {
  const eaten = Math.round(Math.max(0, eatenKcal))
  if (!target || target <= 0) return { kind: 'eaten', eaten }
  if (eaten > target) return { kind: 'over', eaten, target, over: eaten - target, progress: 1 }
  return { kind: 'left', eaten, target, left: target - eaten, progress: eaten / target }
}

/** The review card's title for the time of day. */
export function reviewTitle(now: Date): { title: string; evening: boolean } {
  const hour = now.getHours()
  if (hour < 12) return { title: 'Morning review', evening: false }
  if (hour < 17) return { title: 'Afternoon review', evening: false }
  return { title: 'Evening review', evening: true }
}
