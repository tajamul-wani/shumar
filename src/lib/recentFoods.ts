import { USER_CACHE_PREFIX } from './auth.ts'
import { deviceStorage } from './deviceStorage.ts'
import { parseFood, type FoodResult } from './foodSearch.ts'

/**
 * The foods a person added most recently, kept on this device so the log sheet can show them
 * before any search. Stored under the user cache prefix, so signing out clears them.
 */
export const RECENT_FOODS_KEY = `${USER_CACHE_PREFIX}recent-foods`
export const MAX_RECENT_FOODS = 10

export interface RecentFood {
  food: FoodResult
  /** The unit and amount last used, so one tap adds the same again. */
  unitName: string
  quantity: number
}

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Device storage can be edited or corrupted, so every entry is checked again when read. */
export function readRecentFoods(storage: ReadStorage | undefined = deviceStorage()): RecentFood[] {
  let raw: unknown
  try {
    raw = JSON.parse(storage?.getItem(RECENT_FOODS_KEY) ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  const recent: RecentFood[] = []
  for (const entry of raw.slice(0, MAX_RECENT_FOODS)) {
    const food = parseFood(entry?.food)
    const quantity = typeof entry?.quantity === 'number' && entry.quantity > 0 ? entry.quantity : null
    const unitName = food?.units.some((u) => u.name === entry?.unitName) ? (entry.unitName as string) : null
    if (food && quantity !== null && unitName !== null) recent.push({ food, unitName, quantity })
  }
  return recent
}

function write(recent: RecentFood[], storage: WriteStorage | undefined): RecentFood[] {
  try {
    storage?.setItem(RECENT_FOODS_KEY, JSON.stringify(recent))
  } catch {
    // Storage is full or blocked: the list just won't be remembered.
  }
  return recent
}

/** Puts a food first in the recent list, without duplicates, and returns the new list. */
export function rememberFood(
  entry: RecentFood,
  storage: WriteStorage | undefined = deviceStorage(),
): RecentFood[] {
  const sameFood = (other: RecentFood) =>
    other.food.source === entry.food.source && other.food.sourceId === entry.food.sourceId
  const recent = [entry, ...readRecentFoods(storage).filter((other) => !sameFood(other))].slice(
    0,
    MAX_RECENT_FOODS,
  )
  return write(recent, storage)
}

/**
 * Takes a food off the recent list, as when the person changes or removes a food of their own, so
 * one tap never adds it with values that no longer hold. Returns the new list.
 */
export function forgetFood(
  food: Pick<FoodResult, 'source' | 'sourceId'>,
  storage: WriteStorage | undefined = deviceStorage(),
): RecentFood[] {
  const recent = readRecentFoods(storage)
  const left = recent.filter(
    (entry) => entry.food.source !== food.source || entry.food.sourceId !== food.sourceId,
  )
  return left.length === recent.length ? recent : write(left, storage)
}
