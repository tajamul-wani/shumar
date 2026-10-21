import { describe, expect, it, vi } from 'vitest'
import type { FoodResult } from './foodSearch.ts'
import { LogError, buildLogRow, logFood, saveLog, type NewLog } from './logs.ts'

// A made-up food with easy numbers for checking the maths, not nutrition data.
const food: FoodResult = {
  source: 'usda',
  sourceId: '1001',
  name: 'Test rice, cooked',
  per100g: { kcal: 130, protein: 2.5, carbs: 28, fat: 0.3, sodiumMg: 1 },
  units: [
    { name: 'g', grams: 1 },
    { name: '1 cup', grams: 160 },
  ],
  flagged: false,
  verified: true,
}

function log(overrides: Partial<NewLog> = {}): NewLog {
  return {
    meal: 'lunch',
    food,
    quantity: 1,
    unit: food.units[1],
    date: new Date(2026, 9, 21, 13, 0),
    ...overrides,
  }
}

describe('buildLogRow', () => {
  it('stores the amount, the grams and a snapshot of the nutrients', () => {
    expect(buildLogRow(log({ quantity: 2 }))).toEqual({
      log_date: '2026-10-21',
      meal: 'lunch',
      food_name: 'Test rice, cooked',
      food_source: 'usda',
      food_source_id: '1001',
      quantity: 2,
      unit_name: '1 cup',
      grams: 320,
      kcal: 416,
      protein: 8,
      carbs: 89.6,
      fat: 0.96,
      sodium_mg: 3.2,
    })
  })

  it('handles half a unit and rounds to the two decimals the database keeps', () => {
    const row = buildLogRow(log({ quantity: 0.333 }))
    expect(row.quantity).toBe(0.33)
    expect(row.grams).toBe(52.8)
    expect(row.kcal).toBe(68.64)
  })

  it('dates a meal just after midnight on the local new day', () => {
    expect(buildLogRow(log({ date: new Date(2026, 9, 22, 0, 10) })).log_date).toBe('2026-10-22')
  })

  it.each([0, -1, 0.001, 10001, Number.NaN])('refuses an amount of %s', (quantity) => {
    expect(() => buildLogRow(log({ quantity }))).toThrow(LogError)
  })

  it('refuses more than 20 kg', () => {
    expect(() => buildLogRow(log({ quantity: 200 }))).toThrow('more than 20 kg')
  })

  it('refuses an unknown meal', () => {
    expect(() => buildLogRow(log({ meal: 'brunch' as never }))).toThrow('Choose a meal')
  })
})

function fakeClient(error: { message: string } | null) {
  const insert = vi.fn<(row: unknown) => Promise<unknown>>().mockResolvedValue({ error })
  const from = vi.fn<(table: string) => unknown>(() => ({ insert }))
  return { client: { from } as unknown as Parameters<typeof saveLog>[0], from, insert }
}

describe('saveLog', () => {
  it('inserts the row into user_logs', async () => {
    const { client, from, insert } = fakeClient(null)
    const row = buildLogRow(log())
    await saveLog(client, row)
    expect(from).toHaveBeenCalledWith('user_logs')
    expect(insert).toHaveBeenCalledWith(row)
  })

  it('explains a failed save', async () => {
    const { client } = fakeClient({ message: 'offline' })
    await expect(saveLog(client, buildLogRow(log()))).rejects.toThrow("couldn't save this food")
  })
})

describe('logFood', () => {
  it('builds the row for the given moment and saves it', async () => {
    const { client, insert } = fakeClient(null)
    const { date, ...rest } = log({ quantity: 2 })
    const row = await logFood(client, rest, date)
    expect(row).toEqual(buildLogRow(log({ quantity: 2 })))
    expect(insert).toHaveBeenCalledWith(row)
  })

  it('dates the log today when no date is given', async () => {
    const { client } = fakeClient(null)
    const { date: _, ...rest } = log()
    expect((await logFood(client, rest)).log_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('saves nothing when the amount is refused', async () => {
    const { client, insert } = fakeClient(null)
    const { date, ...rest } = log({ quantity: 0 })
    await expect(logFood(client, rest, date)).rejects.toThrow(LogError)
    expect(insert).not.toHaveBeenCalled()
  })
})
