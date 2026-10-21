import { describe, expect, it, vi } from 'vitest'
import { FoodSearchError, createFoodSearch, normalizeQuery, parseResults } from './foodSearch.ts'

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
    const search = createFoodSearch(client, 2)
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
