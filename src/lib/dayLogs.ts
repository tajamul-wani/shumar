import type { SupabaseClient } from '@supabase/supabase-js'
import type { FoodResult, FoodUnit } from './foodSearch.ts'
import {
  LogError,
  buildLogRow,
  limitMessage,
  foodAmountColumns,
  numberIn,
  parseFoodAmount,
  textUpTo,
  type FoodAmount,
} from './logs.ts'
import { isMeal, type Meal } from './meals.ts'
import { GRAM } from './nutrition.ts'

/**
 * Reading and changing the foods a person has logged. Row-level security limits every query
 * to the signed-in person's own logs, and every row is checked before the app uses it.
 */

export interface LoggedFood extends FoodAmount {
  id: string
  /** The local calendar day, YYYY-MM-DD. */
  logDate: string
  /** When it was logged, as an ISO timestamp. */
  loggedAt: string
  meal: Meal
}

type LogsClient = Pick<SupabaseClient, 'from'>

/** Only the columns the app shows, so each read stays small. */
const LOG_COLUMNS =
  'id, log_date, logged_at, meal, food_name, food_source, food_source_id, quantity, unit_name, grams, kcal, protein, carbs, fat, sodium_mg'

/** Checks one user_logs row against the table's own limits. Returns null if anything is off. */
export function parseLoggedFood(value: unknown): LoggedFood | null {
  const row = (value ?? {}) as Record<string, unknown>
  const id = textUpTo(row.id, 64)
  const logDate =
    typeof row.log_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.log_date) ? row.log_date : null
  const loggedAt = textUpTo(row.logged_at, 64)
  const meal = isMeal(row.meal) ? row.meal : null
  const food = parseFoodAmount(row)
  if (!id || !logDate || !loggedAt || Number.isNaN(Date.parse(loggedAt)) || !meal || !food) return null
  return { id, logDate, loggedAt, meal, ...food }
}

/** A log as its user_logs row, to hand to another screen and read back there with parseLoggedFood. */
export function logRow(log: LoggedFood) {
  return {
    id: log.id,
    log_date: log.logDate,
    logged_at: log.loggedAt,
    meal: log.meal,
    ...foodAmountColumns(log),
  }
}

function parseRows(rows: unknown): LoggedFood[] {
  if (!Array.isArray(rows)) return []
  return rows.map(parseLoggedFood).filter((log): log is LoggedFood => log !== null)
}

/** Everything logged on one day, oldest first. */
export async function fetchDayLogs(client: LogsClient, dateKey: string): Promise<LoggedFood[]> {
  const { data, error } = await client
    .from('user_logs')
    .select(LOG_COLUMNS)
    .eq('log_date', dateKey)
    .order('logged_at')
  if (error) throw new LogError("We couldn't load your food for today. Check your connection and try again.")
  return parseRows(data)
}

/** One log, or null when it doesn't exist or isn't this person's. */
export async function fetchLog(client: LogsClient, id: string): Promise<LoggedFood | null> {
  const { data, error } = await client.from('user_logs').select(LOG_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new LogError("We couldn't load this food. Check your connection and try again.")
  return parseLoggedFood(data)
}

/** How many different days this person has logged food on, or null if it can't be read. */
export async function fetchDaysLogged(client: Pick<SupabaseClient, 'rpc'>): Promise<number | null> {
  const { data, error } = await client.rpc('days_logged')
  if (error) return null
  return numberIn(data, 0, 1e6)
}

export async function removeLog(client: LogsClient, id: string): Promise<void> {
  const { data, error } = await client.from('user_logs').delete().eq('id', id).select('id')
  if (error || !Array.isArray(data) || data.length === 0) {
    throw new LogError("We couldn't remove this food. Check your connection and try again.")
  }
}

/** Puts a removed food back exactly as it was logged, and returns it with its new id. */
export async function restoreLog(client: LogsClient, log: LoggedFood): Promise<LoggedFood> {
  const { data, error } = await client
    .from('user_logs')
    .insert({ log_date: log.logDate, logged_at: log.loggedAt, meal: log.meal, ...foodAmountColumns(log) })
    .select(LOG_COLUMNS)
    .single()
  const restored = error ? null : parseLoggedFood(data)
  if (!restored) {
    throw new LogError(
      limitMessage(error) ?? "We couldn't put this food back. Check your connection and try again.",
    )
  }
  return restored
}

/**
 * The food behind a log, for changing its amount. A log keeps the values it was saved with, so
 * the per-100 g values come from those (keeping what the person saw), and the units on offer are
 * the one it was logged in plus grams. A log keeps no estimate flags, so none are shown.
 */
export function foodFromLog(log: LoggedFood): { food: FoodResult; unit: FoodUnit; quantity: number } {
  const per100 = (value: number) => (value * 100) / log.grams
  const unit = log.unitName === GRAM.name ? GRAM : { name: log.unitName, grams: log.grams / log.quantity }
  const food: FoodResult = {
    source: log.foodSource,
    sourceId: log.foodSourceId ?? log.id,
    name: log.foodName,
    per100g: {
      kcal: per100(log.nutrients.kcal),
      protein: per100(log.nutrients.protein),
      carbs: per100(log.nutrients.carbs),
      fat: per100(log.nutrients.fat),
      sodiumMg: per100(log.nutrients.sodiumMg),
    },
    units: unit === GRAM ? [GRAM] : [GRAM, unit],
    flagged: false,
    verified: true,
  }
  return { food, unit, quantity: log.quantity }
}

interface LogChange {
  meal: Meal
  quantity: number
  unit: FoodUnit
}

/** Saves a new meal, amount or unit for a log. Its day and food stay the same. */
export async function changeLog(client: LogsClient, log: LoggedFood, change: LogChange): Promise<LoggedFood> {
  const { food } = foodFromLog(log)
  // Noon on the log's own day, so the checked row keeps that day whatever the time zone.
  const row = buildLogRow({ ...change, food, date: new Date(`${log.logDate}T12:00:00`) })
  const { data, error } = await client
    .from('user_logs')
    .update({
      meal: row.meal,
      quantity: row.quantity,
      unit_name: row.unit_name,
      grams: row.grams,
      kcal: row.kcal,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      sodium_mg: row.sodium_mg,
    })
    .eq('id', log.id)
    .select(LOG_COLUMNS)
    .maybeSingle()
  const changed = error ? null : parseLoggedFood(data)
  if (!changed) throw new LogError("We couldn't save your changes. Check your connection and try again.")
  return changed
}

/** Every log this person has, oldest first, for the data download. */
export async function fetchAllLogs(client: LogsClient): Promise<LoggedFood[]> {
  const { data, error } = await client
    .from('user_logs')
    .select(LOG_COLUMNS)
    .order('log_date')
    .order('logged_at')
  if (error) throw new LogError("We couldn't load your logs. Check your connection and try again.")
  return parseRows(data)
}
