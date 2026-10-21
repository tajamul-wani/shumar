import type { SupabaseClient } from '@supabase/supabase-js'
import { localDateKey } from './dates.ts'
import type { FoodResult, FoodUnit } from './foodSearch.ts'
import { isMeal, type Meal } from './meals.ts'
import { gramsFor, scaleNutrients } from './nutrition.ts'

/** The limits user_logs enforces, checked here first so people get a clear message. */
export const MAX_QUANTITY = 10000
export const MAX_LOG_GRAMS = 20000

export interface NewLog {
  meal: Meal
  food: FoodResult
  quantity: number
  unit: FoodUnit
  /** When the food was eaten. Its local calendar day becomes the log date. */
  date: Date
}

/** One user_logs row, with a snapshot of the nutrients so later catalog fixes never rewrite history. */
export interface LogRow {
  log_date: string
  meal: Meal
  food_name: string
  food_source: FoodResult['source']
  food_source_id: string
  quantity: number
  unit_name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  sodium_mg: number
}

export class LogError extends Error {}

function twoPlaces(value: number): number {
  return Math.round(value * 100) / 100
}

/** Checks the amount and works out what to store. The database keeps two decimal places. */
export function buildLogRow({ meal, food, quantity, unit, date }: NewLog): LogRow {
  if (!isMeal(meal)) throw new LogError('Choose a meal first.')
  const amount = twoPlaces(quantity)
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_QUANTITY) {
    throw new LogError('Enter an amount more than 0 and up to 10,000.')
  }
  const grams = gramsFor(amount, unit)
  if (grams > MAX_LOG_GRAMS) throw new LogError('That is more than 20 kg. Check the amount and unit.')
  const values = scaleNutrients(food.per100g, grams)
  return {
    log_date: localDateKey(date),
    meal,
    food_name: food.name,
    food_source: food.source,
    food_source_id: food.sourceId,
    quantity: amount,
    unit_name: unit.name,
    grams: twoPlaces(grams),
    kcal: twoPlaces(values.kcal),
    protein: twoPlaces(values.protein),
    carbs: twoPlaces(values.carbs),
    fat: twoPlaces(values.fat),
    sodium_mg: twoPlaces(values.sodiumMg),
  }
}

/** Saves a log for the signed-in person. Row-level security makes it theirs alone. */
export async function saveLog(client: Pick<SupabaseClient, 'from'>, row: LogRow): Promise<void> {
  const { error } = await client.from('user_logs').insert(row)
  if (error) throw new LogError("We couldn't save this food. Check your connection and try again.")
}

/** Checks and saves a food eaten now (or at date) and returns the row as stored. */
export async function logFood(
  client: Pick<SupabaseClient, 'from'>,
  log: Omit<NewLog, 'date'>,
  date: Date = new Date(),
): Promise<LogRow> {
  const row = buildLogRow({ ...log, date })
  await saveLog(client, row)
  return row
}
