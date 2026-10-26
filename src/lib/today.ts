import type { LoggedFood } from './dayLogs.ts'
import { FIXED_MEALS, isFixedMeal, type Meal } from './meals.ts'
import { sumNutrients, type Nutrients } from './nutrition.ts'

/** What the Today screen shows, worked out from the day's logs. Kept apart from the screen so it can be tested. */

export interface MealGroup {
  meal: Meal
  foods: LoggedFood[]
  totals: Nutrients
  /** When the first food of this meal was logged, as an ISO timestamp. */
  firstLoggedAt: string
}

interface DaySummary {
  totals: Nutrients
  /** Only meals with food in them: the fixed meals in the order of the day, then the person's own meals in the order they were first logged. */
  meals: MealGroup[]
}

const byTime = (a: LoggedFood, b: LoggedFood) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt)

export function summarizeDay(logs: readonly LoggedFood[]): DaySummary {
  const sorted = [...logs].sort(byTime)
  const own: Meal[] = []
  for (const log of sorted) {
    if (!isFixedMeal(log.meal) && !own.includes(log.meal)) own.push(log.meal)
  }
  const meals: MealGroup[] = []
  for (const meal of [...FIXED_MEALS, ...own]) {
    const foods = sorted.filter((log) => log.meal === meal)
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

/** The meal with the most calories, when the day has more than one meal with something in it. */
export function biggestMeal(groups: readonly MealGroup[]): Meal | null {
  if (groups.length < 2) return null
  let top = groups[0]
  for (const group of groups) if (group.totals.kcal > top.totals.kcal) top = group
  return top.totals.kcal > 0 ? top.meal : null
}

/** The three macros' shares of a meal's energy: protein and carbs at 4 kcal a gram, fat at 9. */
export function macroShares(nutrients: Nutrients): { protein: number; carbs: number; fat: number } {
  const protein = nutrients.protein * 4
  const carbs = nutrients.carbs * 4
  const fat = nutrients.fat * 9
  const total = protein + carbs + fat
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 }
  return { protein: protein / total, carbs: carbs / total, fat: fat / total }
}

export interface FoodEntry {
  /** The logs this row stands for, oldest first: one, or several identical ones. */
  logs: LoggedFood[]
  /** All of them together. */
  totals: Nutrients
}

/** The same food in the same unit and amount: logged more than once, it shows as one row. */
function entryKey(log: LoggedFood): string {
  return [log.foodSource, log.foodSourceId ?? '', log.foodName, log.unitName, log.quantity].join('|')
}

/** A meal's foods as rows, joining identical entries, in the order each was first logged. */
export function groupMealFoods(foods: readonly LoggedFood[]): FoodEntry[] {
  const rows = new Map<string, LoggedFood[]>()
  for (const food of [...foods].sort(byTime)) {
    const key = entryKey(food)
    rows.set(key, [...(rows.get(key) ?? []), food])
  }
  return [...rows.values()].map((logs) => ({ logs, totals: sumNutrients(logs.map((log) => log.nutrients)) }))
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

export type MacroKey = 'protein' | 'carbs' | 'fat'

export interface MacroBehind {
  key: MacroKey
  eaten: number
  target: number
}

/** The macro with the smallest share of its target eaten, or null once every target is met. */
export function furthestBehind(
  totals: Pick<Nutrients, MacroKey>,
  targets: Pick<Nutrients, MacroKey>,
): MacroBehind | null {
  let behind: MacroBehind | null = null
  let lowest = 1
  for (const key of ['protein', 'carbs', 'fat'] as const) {
    const target = targets[key]
    if (target <= 0) continue
    const share = totals[key] / target
    if (share < lowest) {
      lowest = share
      behind = { key, eaten: totals[key], target }
    }
  }
  return behind
}

/** The review card's title for the time of day. */
export function reviewTitle(now: Date): { title: string; evening: boolean } {
  const hour = now.getHours()
  if (hour < 12) return { title: 'Morning review', evening: false }
  if (hour < 17) return { title: 'Afternoon review', evening: false }
  return { title: 'Evening review', evening: true }
}
