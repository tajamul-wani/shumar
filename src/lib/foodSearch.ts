import type { SupabaseClient } from '@supabase/supabase-js'
import { USER_CACHE_PREFIX } from './auth.ts'
import { localDateKey } from './dates.ts'
import { deviceStorage } from './deviceStorage.ts'

/**
 * Food search: one call to the database's search_foods function, which looks in the person's own
 * foods first, then our Kashmiri catalog, then the imported USDA foods. Nothing here calls an outside API.
 * Every row is checked before the app uses it, and a search already made today is answered on
 * the device without asking the database again.
 */

/** mine: a food the person added from its pack (src/lib/myFoods.ts). */
export type FoodSource = 'kashmiri' | 'mine' | 'usda'

export interface FoodUnit {
  name: string
  grams: number
}

export interface FoodResult {
  source: FoodSource
  sourceId: string
  name: string
  /** Per 100 g as eaten. Sodium in mg. */
  per100g: { kcal: number; protein: number; carbs: number; fat: number; sodiumMg: number }
  /** Always starts with grams, then the food's household units. */
  units: FoodUnit[]
  /** The values failed the Atwater check, so they may be less reliable. */
  flagged: boolean
  /** Confirmed by a second weighing or source (USDA foods always are). */
  verified: boolean
}

export const MIN_QUERY_LENGTH = 2
export const MAX_QUERY_LENGTH = 64
const MAX_RESULTS = 20
/** How many different searches a day are kept. Each takes a few kilobytes on the device. */
const MAX_KEPT_SEARCHES = 100
/** Stored under the user cache prefix, so signing out clears it with everything else. */
export const SEARCH_CACHE_KEY = `${USER_CACHE_PREFIX}food-searches`
/** Raise this when the stored shape changes, so copies in the old shape are ignored. */
const SEARCH_CACHE_VERSION = 1
const GRAMS: FoodUnit = { name: 'g', grams: 1 }

export class FoodSearchError extends Error {}

/** Lower case, single spaces, at most 64 characters: the same rules the database applies. */
export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_QUERY_LENGTH).trim()
}

function number(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : null
}

function text(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.trim() !== '' && value.length <= maxLength ? value : null
}

export function isFoodSource(value: unknown): value is FoodSource {
  return value === 'kashmiri' || value === 'mine' || value === 'usda'
}

function parseUnits(value: unknown): FoodUnit[] {
  const units: FoodUnit[] = [GRAMS]
  if (!Array.isArray(value)) return units
  for (const raw of value) {
    const unit = raw as { name?: unknown; grams?: unknown }
    const name = text(unit?.name, 60)
    const grams = number(unit?.grams, Number.MIN_VALUE, 5000)
    if (name && grams !== null && name !== GRAMS.name) units.push({ name, grams })
  }
  return units
}

/**
 * Checks a food in the app's own shape, such as one read back from the device, and returns a
 * clean copy, or null if anything doesn't make sense. Every food the app uses passes through here.
 */
export function parseFood(value: unknown): FoodResult | null {
  const food = value as Partial<Record<keyof FoodResult, unknown>> | null
  const per100g = (food?.per100g ?? {}) as Record<string, unknown>
  const source = isFoodSource(food?.source) ? food.source : null
  const sourceId = text(food?.sourceId, 64)
  const name = text(food?.name, 200)
  const kcal = number(per100g.kcal, 0, 1000)
  const protein = number(per100g.protein, 0, 100)
  const carbs = number(per100g.carbs, 0, 100)
  const fat = number(per100g.fat, 0, 100)
  const sodiumMg = number(per100g.sodiumMg, 0, 40000)
  if (
    !source ||
    !sourceId ||
    !name ||
    kcal === null ||
    protein === null ||
    carbs === null ||
    fat === null ||
    sodiumMg === null
  ) {
    return null
  }
  return {
    source,
    sourceId,
    name,
    per100g: { kcal, protein, carbs, fat, sodiumMg },
    units: parseUnits(food?.units),
    flagged: food?.flagged === true,
    verified: food?.verified === true,
  }
}

/** Turns rows from search_foods into results, leaving out any row that doesn't make sense. */
export function parseResults(rows: unknown): FoodResult[] {
  if (!Array.isArray(rows)) return []
  const results: FoodResult[] = []
  for (const raw of rows) {
    const row = (raw ?? {}) as Record<string, unknown>
    const food = parseFood({
      source: row.source,
      sourceId: row.source_id,
      name: row.name,
      per100g: {
        kcal: row.kcal_per_100g,
        protein: row.protein_per_100g,
        carbs: row.carbs_per_100g,
        fat: row.fat_per_100g,
        sodiumMg: row.sodium_mg_per_100g,
      },
      units: row.units,
      flagged: row.flagged,
      verified: row.verified,
    })
    if (food) results.push(food)
  }
  return results
}

interface FoodSearch {
  search(query: string, signal?: AbortSignal): Promise<FoodResult[]>
  /**
   * Forgets every kept search, on the device too. After the person adds, changes or removes a food
   * of their own, the searches kept today would show it wrongly.
   */
  forget(): void
}

type SearchStorage = Pick<Storage, 'getItem' | 'setItem'>

interface FoodSearchOptions {
  /** How many different searches to keep. */
  cacheSize?: number
  /** Where the day's searches are kept between visits. Nothing is kept on the device without it. */
  storage?: SearchStorage
  /** Whose searches these are. A copy kept for anyone else is never used. */
  userId?: string
  now?: () => Date
}

interface KeptSearches {
  version: number
  user: string
  day: string
  /** Oldest first, as [query, results]. */
  searches: [string, FoodResult[]][]
}

/**
 * Reads the searches kept on the device for this person and day. Device storage can be edited,
 * so every food is checked again, and a search with any food that fails the check is dropped
 * whole rather than shown in part.
 */
function readKeptSearches(storage: SearchStorage | undefined, user: string, day: string, limit: number) {
  const kept = new Map<string, FoodResult[]>()
  let stored: Partial<KeptSearches> | null
  try {
    stored = JSON.parse(storage?.getItem(SEARCH_CACHE_KEY) ?? 'null')
  } catch {
    return kept
  }
  if (
    stored?.version !== SEARCH_CACHE_VERSION ||
    stored.user !== user ||
    stored.day !== day ||
    !Array.isArray(stored.searches)
  ) {
    return kept
  }
  for (const entry of stored.searches.slice(-limit)) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) continue
    const query = normalizeQuery(entry[0])
    const results = (entry[1] as unknown[]).slice(0, MAX_RESULTS).map(parseFood)
    if (query.length >= MIN_QUERY_LENGTH && results.every((food) => food !== null)) {
      kept.set(query, results as FoodResult[])
    }
  }
  return kept
}

/**
 * Creates a search that keeps its results for the rest of the day, in memory and on the device,
 * so the same search again (after going back, a reload, or reopening the app) costs no request.
 * Identical searches already on their way are shared. A new day starts with nothing kept, so
 * changes to the food catalog show up by the next day at the latest.
 */
export function createFoodSearch(
  client: Pick<SupabaseClient, 'rpc'>,
  {
    cacheSize = MAX_KEPT_SEARCHES,
    storage = deviceStorage(),
    userId = '',
    now = () => new Date(),
  }: FoodSearchOptions = {},
): FoodSearch {
  let day = localDateKey(now())
  const cache = readKeptSearches(storage, userId, day, cacheSize)
  const pending = new Map<string, Promise<FoodResult[]>>()
  /** Counts the times everything was forgotten, so an answer asked for before that is not kept. */
  let generation = 0

  function keepOnDevice() {
    const kept: KeptSearches = {
      version: SEARCH_CACHE_VERSION,
      user: userId,
      day,
      searches: [...cache],
    }
    try {
      storage?.setItem(SEARCH_CACHE_KEY, JSON.stringify(kept))
    } catch {
      // Storage is full or blocked: searches are still kept in memory while the app is open.
    }
  }

  function remember(query: string, results: FoodResult[]) {
    cache.delete(query)
    cache.set(query, results)
    if (cache.size > cacheSize) cache.delete(cache.keys().next().value as string)
  }

  async function fetchResults(query: string, signal?: AbortSignal): Promise<FoodResult[]> {
    const asked = generation
    let request = client.rpc('search_foods', { query, max_results: MAX_RESULTS })
    if (signal) request = request.abortSignal(signal)
    const { data, error } = await request
    if (error) throw new FoodSearchError(error.message)
    const results = parseResults(data)
    if (asked === generation) {
      remember(query, results)
      keepOnDevice()
    }
    return results
  }

  return {
    async search(raw, signal) {
      const query = normalizeQuery(raw)
      if (query.length < MIN_QUERY_LENGTH) return []
      const today = localDateKey(now())
      if (today !== day) {
        day = today
        cache.clear()
      }
      const cached = cache.get(query)
      if (cached) {
        remember(query, cached)
        return cached
      }
      const inFlight = pending.get(query)
      if (inFlight) return inFlight
      const request = fetchResults(query, signal).finally(() => pending.delete(query))
      pending.set(query, request)
      return request
    },
    forget() {
      generation += 1
      cache.clear()
      pending.clear()
      keepOnDevice()
    },
  }
}

const shared = new WeakMap<object, Map<string, FoodSearch>>()

/**
 * One search per client and person, so its kept searches last while the app is open, and a
 * different person signing in on the same device starts with none of the last person's.
 */
export function getFoodSearch(client: Pick<SupabaseClient, 'rpc'>, userId = ''): FoodSearch {
  let byUser = shared.get(client)
  if (!byUser) {
    byUser = new Map()
    shared.set(client, byUser)
  }
  let search = byUser.get(userId)
  if (!search) {
    search = createFoodSearch(client, { userId })
    byUser.set(userId, search)
  }
  return search
}
