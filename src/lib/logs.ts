import type { SupabaseClient } from '@supabase/supabase-js'
import { localDateKey } from './dates.ts'
import type { FoodResult, FoodSource, FoodUnit } from './foodSearch.ts'
import { isMeal, type Meal } from './meals.ts'
import { gramsFor, scaleNutrients, type Nutrients } from './nutrition.ts'

/** The limits user_logs enforces, checked here first so people get a clear message. */
export const MAX_QUANTITY = 10000
const MAX_LOG_GRAMS = 20000

export interface NewLog {
  meal: Meal
  food: FoodResult
  quantity: number
  unit: FoodUnit
  /** When the food was eaten. Its local calendar day becomes the log date. */
  date: Date
}

/** One user_logs row, with a snapshot of the nutrients so later catalog fixes never rewrite history. */
interface LogRow {
  log_date: string
  meal: Meal
  food_name: string
  food_source: FoodResult['source']
  food_source_id: string | null
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

/**
 * What the person reads when the database refuses a row for one of its storage limits
 * (supabase/migrations/20261027120000_storage_limits.sql), by the error code each limit raises.
 */
const LIMIT_MESSAGES: Record<string, string> = {
  SH001: 'A day holds up to 100 foods. Remove one to add another.',
  SH002: 'Your account holds up to 50,000 foods, and it is full.',
  SH003: 'You have 20 saved meals. Remove one to save another.',
  SH004: 'A saved meal holds up to 30 foods.',
}

/** The plain message for a storage limit the database refused a row for, or null for any other error. */
export function limitMessage(error: { code?: string } | null | undefined): string | null {
  return (error?.code && LIMIT_MESSAGES[error.code]) || null
}

/**
 * A food with the amount and the nutrients it was saved with: what a logged food and a food in a
 * saved meal have in common, and all that copying one into a meal needs.
 */
export interface FoodAmount {
  foodName: string
  foodSource: FoodSource
  foodSourceId: string | null
  quantity: number
  unitName: string
  grams: number
  /** The values saved with it. */
  nutrients: Nutrients
}

/** A number within limits, as a number or the text Postgres sends for numeric columns; null otherwise. */
export function numberIn(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : null
}

/** Non-empty text up to a length; null otherwise. */
export function textUpTo(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.trim() !== '' && value.length <= maxLength ? value : null
}

/** Checks the food, amount and nutrient columns of a row against the tables' own limits. */
export function parseFoodAmount(value: unknown): FoodAmount | null {
  const row = (value ?? {}) as Record<string, unknown>
  const foodName = textUpTo(row.food_name, 200)
  const foodSource = row.food_source === 'kashmiri' || row.food_source === 'usda' ? row.food_source : null
  const foodSourceId = row.food_source_id == null ? null : textUpTo(row.food_source_id, 100)
  const quantity = numberIn(row.quantity, Number.MIN_VALUE, 10000)
  const unitName = textUpTo(row.unit_name, 60)
  const grams = numberIn(row.grams, Number.MIN_VALUE, 20000)
  const kcal = numberIn(row.kcal, 0, 1e6)
  const protein = numberIn(row.protein, 0, 1e5)
  const carbs = numberIn(row.carbs, 0, 1e5)
  const fat = numberIn(row.fat, 0, 1e5)
  const sodiumMg = numberIn(row.sodium_mg, 0, 1e7)
  if (
    !foodName ||
    !foodSource ||
    (row.food_source_id != null && !foodSourceId) ||
    quantity === null ||
    !unitName ||
    grams === null ||
    kcal === null ||
    protein === null ||
    carbs === null ||
    fat === null ||
    sodiumMg === null
  ) {
    return null
  }
  return {
    foodName,
    foodSource,
    foodSourceId,
    quantity,
    unitName,
    grams,
    nutrients: { kcal, protein, carbs, fat, sodiumMg },
  }
}

/** The columns a food's amount and nutrients take in user_logs and saved_meal_foods. */
export function foodAmountColumns(food: FoodAmount) {
  return {
    food_name: food.foodName,
    food_source: food.foodSource,
    food_source_id: food.foodSourceId,
    quantity: food.quantity,
    unit_name: food.unitName,
    grams: food.grams,
    kcal: food.nutrients.kcal,
    protein: food.nutrients.protein,
    carbs: food.nutrients.carbs,
    fat: food.nutrients.fat,
    sodium_mg: food.nutrients.sodiumMg,
  }
}

function twoPlaces(value: number): number {
  return Math.round(value * 100) / 100
}

/** Checks an amount of a food and works out what it holds. The database keeps two decimal places. */
export function amountFor({ food, quantity, unit }: Pick<NewLog, 'food' | 'quantity' | 'unit'>): FoodAmount {
  const amount = twoPlaces(quantity)
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_QUANTITY) {
    throw new LogError('Enter an amount more than 0 and up to 10,000.')
  }
  const grams = gramsFor(amount, unit)
  if (grams > MAX_LOG_GRAMS) throw new LogError('That is more than 20 kg. Check the amount and unit.')
  const values = scaleNutrients(food.per100g, grams)
  return {
    foodName: food.name,
    foodSource: food.source,
    foodSourceId: food.sourceId,
    quantity: amount,
    unitName: unit.name,
    grams: twoPlaces(grams),
    nutrients: {
      kcal: twoPlaces(values.kcal),
      protein: twoPlaces(values.protein),
      carbs: twoPlaces(values.carbs),
      fat: twoPlaces(values.fat),
      sodiumMg: twoPlaces(values.sodiumMg),
    },
  }
}

/** Checks the amount and works out what to store. */
export function buildLogRow({ meal, food, quantity, unit, date }: NewLog): LogRow {
  if (!isMeal(meal)) throw new LogError('Choose a meal first.')
  return { log_date: localDateKey(date), meal, ...foodAmountColumns(amountFor({ food, quantity, unit })) }
}

/** Saves a log for the signed-in person. Row-level security makes it theirs alone. */
export async function saveLog(client: Pick<SupabaseClient, 'from'>, row: LogRow): Promise<void> {
  const { error } = await client.from('user_logs').insert(row)
  if (error) {
    throw new LogError(
      limitMessage(error) ?? "We couldn't save this food. Check your connection and try again.",
    )
  }
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

/**
 * Logs several foods at once, exactly as they were logged or saved before (yesterday's meal, or a
 * saved meal), into one meal on one day. One request, so they all go in or none do.
 */
export async function copyFoods(
  client: Pick<SupabaseClient, 'from'>,
  foods: readonly FoodAmount[],
  meal: Meal,
  date: Date = new Date(),
): Promise<number> {
  if (!isMeal(meal)) throw new LogError('Choose a meal first.')
  if (foods.length === 0) return 0
  const logDate = localDateKey(date)
  const rows = foods.map((food) => ({ log_date: logDate, meal, ...foodAmountColumns(food) }))
  const { error } = await client.from('user_logs').insert(rows)
  if (error) {
    throw new LogError(
      limitMessage(error) ?? "We couldn't add these foods. Check your connection and try again.",
    )
  }
  return rows.length
}
