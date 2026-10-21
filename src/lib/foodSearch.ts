import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Food search: one call to the database's search_foods function, which looks in our own
 * Kashmiri catalog first and then in the imported USDA foods. Nothing here calls an outside API.
 * Every row is checked before the app uses it, and repeat searches are answered from memory.
 */

export type FoodSource = 'kashmiri' | 'usda'

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
export const MAX_RESULTS = 20
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

/** Turns rows from search_foods into results, leaving out any row that doesn't make sense. */
export function parseResults(rows: unknown): FoodResult[] {
  if (!Array.isArray(rows)) return []
  const results: FoodResult[] = []
  for (const raw of rows) {
    const row = raw as Record<string, unknown>
    const source = row?.source === 'kashmiri' || row?.source === 'usda' ? row.source : null
    const sourceId = text(row?.source_id, 64)
    const name = text(row?.name, 200)
    const kcal = number(row?.kcal_per_100g, 0, 1000)
    const protein = number(row?.protein_per_100g, 0, 100)
    const carbs = number(row?.carbs_per_100g, 0, 100)
    const fat = number(row?.fat_per_100g, 0, 100)
    const sodiumMg = number(row?.sodium_mg_per_100g, 0, 40000)
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
      continue
    }
    results.push({
      source,
      sourceId,
      name,
      per100g: { kcal, protein, carbs, fat, sodiumMg },
      units: parseUnits(row.units),
      flagged: row.flagged === true,
      verified: row.verified === true,
    })
  }
  return results
}

export interface FoodSearch {
  search(query: string, signal?: AbortSignal): Promise<FoodResult[]>
}

/**
 * Creates a search that remembers its last results in memory, so typing the same search again
 * (or going back to it) costs no request. Identical searches already on their way are shared.
 * The results are the public food catalog, not personal data.
 */
export function createFoodSearch(client: Pick<SupabaseClient, 'rpc'>, cacheSize = 50): FoodSearch {
  const cache = new Map<string, FoodResult[]>()
  const pending = new Map<string, Promise<FoodResult[]>>()

  function remember(query: string, results: FoodResult[]) {
    cache.delete(query)
    cache.set(query, results)
    if (cache.size > cacheSize) cache.delete(cache.keys().next().value as string)
  }

  async function fetchResults(query: string, signal?: AbortSignal): Promise<FoodResult[]> {
    let request = client.rpc('search_foods', { query, max_results: MAX_RESULTS })
    if (signal) request = request.abortSignal(signal)
    const { data, error } = await request
    if (error) throw new FoodSearchError(error.message)
    const results = parseResults(data)
    remember(query, results)
    return results
  }

  return {
    async search(raw, signal) {
      const query = normalizeQuery(raw)
      if (query.length < MIN_QUERY_LENGTH) return []
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
  }
}
