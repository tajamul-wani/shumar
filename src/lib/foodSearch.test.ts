import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearUserData } from './auth.ts'
import {
  FoodSearchError,
  SEARCH_CACHE_KEY,
  createFoodSearch,
  getFoodSearch,
  normalizeQuery,
  parseFood,
  parseResults,
} from './foodSearch.ts'

// Made-up rows for testing the parser, not nutrition data.
function row(overrides: Record<string, unknown> = {}) {
  return {
    source: 'usda',
    source_id: '1001',
    name: 'Test food, cooked',
    kcal_per_100g: 120,
    protein_per_100g: 3,
    carbs_per_100g: 25,
    fat_per_100g: 1,
    sodium_mg_per_100g: 5,
    flagged: false,
    verified: true,
    units: [{ name: '1 cup', grams: 158 }],
    ...overrides,
  }
}

type RpcResult = { data: unknown; error: { message: string } | null }

function fakeClient(respond: (args: Record<string, unknown>) => RpcResult | Promise<RpcResult>) {
  const abortSignal = vi.fn<(signal: AbortSignal) => unknown>()
  const rpc = vi.fn<(name: string, args: Record<string, unknown>) => unknown>((_name, args) => {
    const request = Promise.resolve().then(() => respond(args))
    return Object.assign(request, {
      abortSignal: (signal: AbortSignal) => {
        abortSignal(signal)
        return request
      },
    })
  })
  return { client: { rpc } as unknown as Parameters<typeof createFoodSearch>[0], rpc, abortSignal }
}

/** Device storage held in memory, so each test starts empty. */
function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: vi.fn<(key: string, value: string) => void>((key, value) => {
      items.set(key, value)
    }),
  }
}

const morning = () => new Date(2026, 9, 21, 8, 0)
const evening = () => new Date(2026, 9, 21, 21, 0)
const nextMorning = () => new Date(2026, 9, 22, 8, 0)

afterEach(() => {
  localStorage.clear()
})

describe('normalizeQuery', () => {
  it('lowercases, collapses spaces and trims', () => {
    expect(normalizeQuery('  Nun   Chai \n')).toBe('nun chai')
  })

  it('cuts the search at 64 characters', () => {
    expect(normalizeQuery('a'.repeat(100))).toHaveLength(64)
  })
})

describe('parseResults', () => {
  it('turns a row into a result, with grams first among the units', () => {
    expect(parseResults([row()])).toEqual([
      {
        source: 'usda',
        sourceId: '1001',
        name: 'Test food, cooked',
        per100g: { kcal: 120, protein: 3, carbs: 25, fat: 1, sodiumMg: 5 },
        units: [
          { name: 'g', grams: 1 },
          { name: '1 cup', grams: 158 },
        ],
        flagged: false,
        verified: true,
      },
    ])
  })

  it('accepts numbers sent as text', () => {
    expect(parseResults([row({ kcal_per_100g: '120.50' })])[0].per100g.kcal).toBe(120.5)
  })

  it.each([
    ['an unknown source', { source: 'web' }],
    ['a missing name', { name: '' }],
    ['a missing id', { source_id: null }],
    ['calories out of range', { kcal_per_100g: 2000 }],
    ['negative protein', { protein_per_100g: -1 }],
    ['fat that is not a number', { fat_per_100g: 'lots' }],
    ['sodium out of range', { sodium_mg_per_100g: 50000 }],
  ])('leaves out a row with %s', (_, overrides) => {
    expect(parseResults([row(overrides), row({ source_id: '2' })]).map((r) => r.sourceId)).toEqual(['2'])
  })

  it('keeps only sensible units and never a second "g"', () => {
    const units = [
      { name: '1 katori', grams: 120 },
      { name: '', grams: 50 },
      { name: '1 piece', grams: 0 },
      { name: 'g', grams: 1 },
      'nonsense',
    ]
    expect(parseResults([row({ units })])[0].units).toEqual([
      { name: 'g', grams: 1 },
      { name: '1 katori', grams: 120 },
    ])
  })

  it('leaves out units in ounces and pounds, which grams already cover', () => {
    const units = [
      { name: '4 oz', grams: 113 },
      { name: '1 fl oz', grams: 30 },
      { name: '1 lb', grams: 454 },
      { name: '1 large', grams: 50 },
      // Ounces in the description in brackets don't make it a unit in ounces.
      { name: '1 cup (8 fl oz)', grams: 244 },
    ]
    expect(parseResults([row({ units })])[0].units).toEqual([
      { name: 'g', grams: 1 },
      { name: '1 large', grams: 50 },
      { name: '1 cup (8 fl oz)', grams: 244 },
    ])
  })

  it('gives grams only when units are missing, and treats odd flags as false', () => {
    const result = parseResults([row({ units: null, flagged: 'yes', verified: 1 })])[0]
    expect(result.units).toEqual([{ name: 'g', grams: 1 }])
    expect([result.flagged, result.verified]).toEqual([false, false])
  })

  it('returns nothing for a response that is not a list', () => {
    expect(parseResults({ rows: [] })).toEqual([])
  })
})

describe('createFoodSearch', () => {
  it('sends the tidied search to the database and returns parsed results', async () => {
    const { client, rpc } = fakeClient(() => ({ data: [row()], error: null }))
    const results = await createFoodSearch(client).search('  RICE  ')
    expect(rpc).toHaveBeenCalledWith('search_foods', { query: 'rice', max_results: 20 })
    expect(results.map((r) => r.name)).toEqual(['Test food, cooked'])
  })

  it('does not search for fewer than 2 characters', async () => {
    const { client, rpc } = fakeClient(() => ({ data: [], error: null }))
    expect(await createFoodSearch(client).search(' r ')).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('answers a repeat search from memory', async () => {
    const { client, rpc } = fakeClient(() => ({ data: [row()], error: null }))
    const search = createFoodSearch(client)
    await search.search('rice')
    await search.search('Rice ')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('forgets the oldest search once the memory is full', async () => {
    const { client, rpc } = fakeClient(() => ({ data: [row()], error: null }))
    const search = createFoodSearch(client, { cacheSize: 2 })
    await search.search('rice')
    await search.search('milk')
    await search.search('rice')
    await search.search('eggs')
    await search.search('rice')
    expect(rpc).toHaveBeenCalledTimes(3)
    await search.search('milk')
    expect(rpc).toHaveBeenCalledTimes(4)
  })

  it('shares one request between identical searches already on their way', async () => {
    const { client, rpc } = fakeClient(() => ({ data: [row()], error: null }))
    const search = createFoodSearch(client)
    await Promise.all([search.search('rice'), search.search('rice')])
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('passes a cancel signal to the request', async () => {
    const { client, abortSignal } = fakeClient(() => ({ data: [], error: null }))
    const controller = new AbortController()
    await createFoodSearch(client).search('rice', controller.signal)
    expect(abortSignal).toHaveBeenCalledWith(controller.signal)
  })

  it('reports a failed search and does not remember it', async () => {
    let fail = true
    const { client, rpc } = fakeClient(() =>
      fail ? { data: null, error: { message: 'offline' } } : { data: [row()], error: null },
    )
    const search = createFoodSearch(client)
    await expect(search.search('rice')).rejects.toThrow(FoodSearchError)
    fail = false
    expect(await search.search('rice')).toHaveLength(1)
    expect(rpc).toHaveBeenCalledTimes(2)
  })
})

describe('forgetting the kept searches', () => {
  it('asks the database again, after a food of their own changed', async () => {
    const storage = memoryStorage()
    const fake = fakeClient(() => ({ data: [row()], error: null }))
    const search = createFoodSearch(fake.client, { storage, userId: 'a', now: morning })
    await search.search('rice')
    search.forget()
    expect(JSON.parse(storage.items.get(SEARCH_CACHE_KEY) ?? '{}').searches).toEqual([])
    await search.search('rice')
    expect(fake.rpc).toHaveBeenCalledTimes(2)
  })

  it('does not keep an answer that was asked for before it forgot', async () => {
    // The first search waits until the test answers it; later ones are answered at once.
    let answer: ((result: RpcResult) => void) | null = null
    const fake = fakeClient(() =>
      answer === null
        ? new Promise<RpcResult>((resolve) => (answer = resolve))
        : { data: [row()], error: null },
    )
    const search = createFoodSearch(fake.client, { storage: memoryStorage(), userId: 'a', now: morning })
    const asked = search.search('rice')
    await Promise.resolve()
    search.forget()
    answer!({ data: [row()], error: null })
    await expect(asked).resolves.toHaveLength(1)
    await search.search('rice')
    expect(fake.rpc).toHaveBeenCalledTimes(2)
  })
})

describe("keeping the day's searches", () => {
  async function searchOnce(storage: ReturnType<typeof memoryStorage>, options = {}) {
    const fake = fakeClient(() => ({ data: [row()], error: null }))
    const results = await createFoodSearch(fake.client, {
      storage,
      userId: 'a',
      now: morning,
      ...options,
    }).search('rice')
    return { ...fake, results }
  }

  it('answers a search made earlier today from the device, even after a reload', async () => {
    const storage = memoryStorage()
    const first = await searchOnce(storage)
    expect(first.rpc).toHaveBeenCalledTimes(1)

    const later = await searchOnce(storage, { now: evening })
    expect(later.rpc).not.toHaveBeenCalled()
    expect(later.results).toEqual(first.results)
  })

  it('starts afresh on a new day', async () => {
    const storage = memoryStorage()
    await searchOnce(storage)
    expect((await searchOnce(storage, { now: nextMorning })).rpc).toHaveBeenCalledTimes(1)
  })

  it('starts afresh at midnight while the app stays open', async () => {
    let now = morning
    const { client, rpc } = fakeClient(() => ({ data: [row()], error: null }))
    const search = createFoodSearch(client, { storage: memoryStorage(), now: () => now() })
    await search.search('rice')
    now = nextMorning
    await search.search('rice')
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it("never uses another person's searches", async () => {
    const storage = memoryStorage()
    await searchOnce(storage)
    expect((await searchOnce(storage, { userId: 'b' })).rpc).toHaveBeenCalledTimes(1)
  })

  it('keeps at most the set number of searches', async () => {
    const storage = memoryStorage()
    const { client } = fakeClient(() => ({ data: [row()], error: null }))
    const search = createFoodSearch(client, { storage, cacheSize: 2, now: morning })
    for (const query of ['rice', 'milk', 'eggs']) await search.search(query)
    const kept = JSON.parse(storage.items.get(SEARCH_CACHE_KEY) ?? '{}')
    expect(kept.searches.map(([query]: [string]) => query)).toEqual(['milk', 'eggs'])
  })

  it.each([
    ['text that is not JSON', '{'],
    ['an older shape', JSON.stringify({ version: 0, user: 'a', day: '2026-10-21', searches: [] })],
    [
      'searches kept before a release changed the order',
      JSON.stringify({ version: 1, user: 'a', day: '2026-10-21', searches: [['rice', []]] }),
    ],
    [
      'searches that are not a list',
      JSON.stringify({ version: 2, user: 'a', day: '2026-10-21', searches: 5 }),
    ],
  ])('ignores %s', async (_, stored) => {
    const storage = memoryStorage({ [SEARCH_CACHE_KEY]: stored })
    expect((await searchOnce(storage)).results).toHaveLength(1)
  })

  it('drops a kept search whole when any of its foods was changed', async () => {
    const storage = memoryStorage()
    const { results } = await searchOnce(storage)
    const kept = JSON.parse(storage.items.get(SEARCH_CACHE_KEY) ?? '{}')
    kept.searches = [
      ['rice', [results[0], { ...results[0], per100g: { ...results[0].per100g, kcal: 5000 } }]],
      ['x', results],
      'nonsense',
    ]
    storage.items.set(SEARCH_CACHE_KEY, JSON.stringify(kept))
    expect((await searchOnce(storage)).rpc).toHaveBeenCalledTimes(1)
  })

  it('keeps working in memory when the device storage is full', async () => {
    const storage = memoryStorage()
    storage.setItem.mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    const { client, rpc } = fakeClient(() => ({ data: [row()], error: null }))
    const search = createFoodSearch(client, { storage, now: morning })
    expect(await search.search('rice')).toHaveLength(1)
    await search.search('rice')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('uses the browser storage by default, which signing out clears', async () => {
    const { client } = fakeClient(() => ({ data: [row()], error: null }))
    await createFoodSearch(client).search('rice')
    expect(localStorage.getItem(SEARCH_CACHE_KEY)).toContain('Test food, cooked')
    clearUserData()
    expect(localStorage.getItem(SEARCH_CACHE_KEY)).toBeNull()
  })
})

describe('a food of their own', () => {
  it('comes through search like any other food', () => {
    const [food] = parseResults([row({ source: 'mine', source_id: 'm1', name: 'Test cheese (Test brand)' })])
    expect(food).toMatchObject({ source: 'mine', sourceId: 'm1', name: 'Test cheese (Test brand)' })
  })
})

describe('parseFood', () => {
  it('accepts a food in the app shape and returns a clean copy', () => {
    const [food] = parseResults([row()])
    expect(parseFood(JSON.parse(JSON.stringify(food)))).toEqual(food)
  })

  it('refuses a food with impossible values or nothing at all', () => {
    const [food] = parseResults([row()])
    expect(parseFood({ ...food, per100g: { ...food.per100g, fat: 150 } })).toBeNull()
    expect(parseFood(null)).toBeNull()
  })
})

describe('getFoodSearch', () => {
  it('gives the same search, with its memory, for the same client', () => {
    const { client } = fakeClient(() => ({ data: [], error: null }))
    expect(getFoodSearch(client)).toBe(getFoodSearch(client))
    expect(getFoodSearch(fakeClient(() => ({ data: [], error: null })).client)).not.toBe(
      getFoodSearch(client),
    )
  })

  it('gives each person their own search', () => {
    const { client } = fakeClient(() => ({ data: [], error: null }))
    expect(getFoodSearch(client, 'a')).toBe(getFoodSearch(client, 'a'))
    expect(getFoodSearch(client, 'b')).not.toBe(getFoodSearch(client, 'a'))
  })
})
