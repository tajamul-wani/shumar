import { describe, expect, it, vi } from 'vitest'
import {
  changeLog,
  fetchDayLogs,
  fetchDaysLogged,
  fetchLog,
  foodFromLog,
  parseLoggedFood,
  removeLog,
  restoreLog,
  type LoggedFood,
} from './dayLogs.ts'
import { LogError } from './logs.ts'

// Made-up rows with easy numbers for checking the code, not nutrition data.
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    log_date: '2026-10-21',
    logged_at: '2026-10-21T03:10:00+00:00',
    meal: 'breakfast',
    food_name: 'Test tea',
    food_source: 'kashmiri',
    food_source_id: 'k1',
    quantity: 2,
    unit_name: 'cup',
    grams: 300,
    kcal: 90,
    protein: 3,
    carbs: 9,
    fat: 4.5,
    sodium_mg: 600,
    ...overrides,
  }
}

const tea = parseLoggedFood(row()) as LoggedFood

type Result = { data: unknown; error: { message: string } | null }

/** A stand-in for the Supabase query builder: records each call and answers with one result. */
function fakeClient(result: Result) {
  const calls: [string, unknown[]][] = []
  const query: Record<string, unknown> = {
    then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  for (const name of ['select', 'eq', 'order', 'maybeSingle', 'single', 'delete', 'insert', 'update']) {
    query[name] = (...args: unknown[]) => {
      calls.push([name, args])
      return query
    }
  }
  const from = vi.fn<(table: string) => unknown>(() => query)
  const rpc = vi.fn<(name: string) => Promise<Result>>(async () => result)
  return {
    client: { from, rpc } as unknown as Parameters<typeof fetchDayLogs>[0] &
      Parameters<typeof fetchDaysLogged>[0],
    calls,
    from,
    rpc,
  }
}

const call = (calls: [string, unknown[]][], name: string) => calls.find(([n]) => n === name)?.[1]

describe('parseLoggedFood', () => {
  it('turns a row into a logged food, accepting numbers sent as text', () => {
    expect(parseLoggedFood(row({ kcal: '90.00' }))).toEqual({
      id: 'log-1',
      logDate: '2026-10-21',
      loggedAt: '2026-10-21T03:10:00+00:00',
      meal: 'breakfast',
      foodName: 'Test tea',
      foodSource: 'kashmiri',
      foodSourceId: 'k1',
      quantity: 2,
      unitName: 'cup',
      grams: 300,
      nutrients: { kcal: 90, protein: 3, carbs: 9, fat: 4.5, sodiumMg: 600 },
    })
  })

  it('accepts a log with no source id', () => {
    expect(parseLoggedFood(row({ food_source_id: null }))?.foodSourceId).toBeNull()
  })

  it.each([
    ['a meal name the database would refuse', { meal: ' brunch' }],
    ['an unknown source', { food_source: 'web' }],
    ['a date in another shape', { log_date: '21/10/2026' }],
    ['a time that is not a time', { logged_at: 'soon' }],
    ['negative calories', { kcal: -1 }],
    ['no weight', { grams: 0 }],
    ['a missing id', { id: '' }],
    ['a source id that is not text', { food_source_id: 5 }],
  ])('refuses a row with %s', (_, overrides) => {
    expect(parseLoggedFood(row(overrides))).toBeNull()
  })

  it('refuses nothing at all', () => {
    expect(parseLoggedFood(null)).toBeNull()
  })
})

describe('reading logs', () => {
  it("reads one day's logs, oldest first, leaving out rows that don't make sense", async () => {
    const { client, calls, from } = fakeClient({ data: [row(), row({ meal: '' })], error: null })
    expect(await fetchDayLogs(client, '2026-10-21')).toEqual([tea])
    expect(from).toHaveBeenCalledWith('user_logs')
    expect(call(calls, 'eq')).toEqual(['log_date', '2026-10-21'])
    expect(call(calls, 'order')).toEqual(['logged_at'])
    expect(String(call(calls, 'select')?.[0])).not.toContain('user_id')
  })

  it('explains when the day cannot be read', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'offline' } })
    await expect(fetchDayLogs(client, '2026-10-21')).rejects.toThrow("We couldn't load your food for today.")
  })

  it('reads one log, or nothing when it is not there', async () => {
    expect(await fetchLog(fakeClient({ data: row(), error: null }).client, 'log-1')).toEqual(tea)
    expect(await fetchLog(fakeClient({ data: null, error: null }).client, 'log-9')).toBeNull()
    await expect(
      fetchLog(fakeClient({ data: null, error: { message: 'x' } }).client, 'log-1'),
    ).rejects.toThrow(LogError)
  })

  it('reads the number of days logged, or nothing when it cannot', async () => {
    const ok = fakeClient({ data: 12, error: null })
    expect(await fetchDaysLogged(ok.client)).toBe(12)
    expect(ok.rpc).toHaveBeenCalledWith('days_logged')
    expect(await fetchDaysLogged(fakeClient({ data: null, error: { message: 'x' } }).client)).toBeNull()
    expect(await fetchDaysLogged(fakeClient({ data: 'many', error: null }).client)).toBeNull()
  })
})

describe('removing and restoring', () => {
  it('removes a log by its id', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 'log-1' }], error: null })
    await removeLog(client, 'log-1')
    expect(call(calls, 'delete')).toEqual([])
    expect(call(calls, 'eq')).toEqual(['id', 'log-1'])
  })

  it('explains when nothing was removed', async () => {
    await expect(removeLog(fakeClient({ data: [], error: null }).client, 'log-1')).rejects.toThrow(
      "We couldn't remove this food.",
    )
    await expect(
      removeLog(fakeClient({ data: null, error: { message: 'x' } }).client, 'log-1'),
    ).rejects.toThrow(LogError)
  })

  it('puts a removed food back exactly as it was logged', async () => {
    const { client, calls } = fakeClient({ data: row({ id: 'log-2' }), error: null })
    expect(await restoreLog(client, tea)).toEqual({ ...tea, id: 'log-2' })
    expect(call(calls, 'insert')?.[0]).toEqual({
      log_date: '2026-10-21',
      logged_at: '2026-10-21T03:10:00+00:00',
      meal: 'breakfast',
      food_name: 'Test tea',
      food_source: 'kashmiri',
      food_source_id: 'k1',
      quantity: 2,
      unit_name: 'cup',
      grams: 300,
      kcal: 90,
      protein: 3,
      carbs: 9,
      fat: 4.5,
      sodium_mg: 600,
    })
  })

  it('explains when a food cannot be put back', async () => {
    await expect(restoreLog(fakeClient({ data: null, error: { message: 'x' } }).client, tea)).rejects.toThrow(
      "We couldn't put this food back.",
    )
  })
})

describe('changing a log', () => {
  it('works out the food from the values it was logged with', () => {
    const { food, unit, quantity } = foodFromLog(tea)
    expect(food.per100g).toEqual({ kcal: 30, protein: 1, carbs: 3, fat: 1.5, sodiumMg: 200 })
    expect(unit).toEqual({ name: 'cup', grams: 150 })
    expect(food.units).toEqual([{ name: 'g', grams: 1 }, unit])
    expect(quantity).toBe(2)
    expect([food.flagged, food.verified]).toEqual([false, true])
  })

  it('offers only grams for a food logged in grams', () => {
    const { unit, food } = foodFromLog({ ...tea, unitName: 'g', quantity: 300 })
    expect(unit).toEqual({ name: 'g', grams: 1 })
    expect(food.units).toEqual([{ name: 'g', grams: 1 }])
  })

  it('saves a new amount and meal, keeping the day and the food', async () => {
    const { client, calls } = fakeClient({
      data: row({ meal: 'lunch', quantity: 3, grams: 450 }),
      error: null,
    })
    await changeLog(client, tea, { meal: 'lunch', quantity: 3, unit: { name: 'cup', grams: 150 } })
    expect(call(calls, 'update')?.[0]).toEqual({
      meal: 'lunch',
      quantity: 3,
      unit_name: 'cup',
      grams: 450,
      kcal: 135,
      protein: 4.5,
      carbs: 13.5,
      fat: 6.75,
      sodium_mg: 900,
    })
    expect(call(calls, 'eq')).toEqual(['id', 'log-1'])
  })

  it('keeps the values exactly when the amount is unchanged', async () => {
    const odd = parseLoggedFood(
      row({ quantity: 1, unit_name: 'katori', grams: 120, kcal: 98.4, sodium_mg: 7.33 }),
    )
    const { client, calls } = fakeClient({ data: row(), error: null })
    await changeLog(client, odd as LoggedFood, {
      meal: 'breakfast',
      quantity: 1,
      unit: { name: 'katori', grams: 120 },
    })
    expect(call(calls, 'update')?.[0]).toMatchObject({ grams: 120, kcal: 98.4, sodium_mg: 7.33 })
  })

  it('refuses an amount it cannot use without saving anything', async () => {
    const { client, from } = fakeClient({ data: row(), error: null })
    await expect(
      changeLog(client, tea, { meal: 'breakfast', quantity: 0, unit: { name: 'cup', grams: 150 } }),
    ).rejects.toThrow('Enter an amount')
    expect(from).not.toHaveBeenCalled()
  })

  it('explains when the change cannot be saved', async () => {
    const { client } = fakeClient({ data: null, error: null })
    await expect(
      changeLog(client, tea, { meal: 'breakfast', quantity: 1, unit: { name: 'cup', grams: 150 } }),
    ).rejects.toThrow("We couldn't save your changes.")
  })
})
