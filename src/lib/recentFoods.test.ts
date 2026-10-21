import { describe, expect, it } from 'vitest'
import type { FoodResult } from './foodSearch.ts'
import { MAX_RECENT_FOODS, RECENT_FOODS_KEY, readRecentFoods, rememberFood } from './recentFoods.ts'

// Made-up foods for testing storage, not nutrition data.
function food(id: string): FoodResult {
  return {
    source: 'usda',
    sourceId: id,
    name: `Test food ${id}`,
    per100g: { kcal: 100, protein: 1, carbs: 20, fat: 1, sodiumMg: 1 },
    units: [
      { name: 'g', grams: 1 },
      { name: '1 cup', grams: 150 },
    ],
    flagged: false,
    verified: true,
  }
}

function memoryStorage(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[RECENT_FOODS_KEY, initial]])
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  }
}

describe('recent foods', () => {
  it('lives under the user cache prefix, so sign-out clears it', () => {
    expect(RECENT_FOODS_KEY).toBe('shumar-cache:recent-foods')
  })

  it('remembers the newest food first, with its unit and amount', () => {
    const storage = memoryStorage()
    rememberFood({ food: food('1'), unitName: 'g', quantity: 100 }, storage)
    const list = rememberFood({ food: food('2'), unitName: '1 cup', quantity: 2 }, storage)
    expect(list.map((r) => [r.food.sourceId, r.unitName, r.quantity])).toEqual([
      ['2', '1 cup', 2],
      ['1', 'g', 100],
    ])
    expect(readRecentFoods(storage)).toEqual(list)
  })

  it('moves a food added again to the front instead of listing it twice', () => {
    const storage = memoryStorage()
    rememberFood({ food: food('1'), unitName: 'g', quantity: 1 }, storage)
    rememberFood({ food: food('2'), unitName: 'g', quantity: 1 }, storage)
    const list = rememberFood({ food: food('1'), unitName: '1 cup', quantity: 3 }, storage)
    expect(list.map((r) => r.food.sourceId)).toEqual(['1', '2'])
  })

  it(`keeps at most ${MAX_RECENT_FOODS}`, () => {
    const storage = memoryStorage()
    for (let i = 0; i < 15; i += 1)
      rememberFood({ food: food(String(i)), unitName: 'g', quantity: 1 }, storage)
    const list = readRecentFoods(storage)
    expect(list).toHaveLength(MAX_RECENT_FOODS)
    expect(list[0].food.sourceId).toBe('14')
  })

  it('drops entries that were changed into something invalid', () => {
    const good = { food: food('1'), unitName: '1 cup', quantity: 1 }
    const stored = JSON.stringify([
      good,
      { food: { ...food('2'), per100g: { kcal: 5000 } }, unitName: 'g', quantity: 1 },
      { food: food('3'), unitName: 'a unit it does not have', quantity: 1 },
      { food: food('4'), unitName: 'g', quantity: -2 },
      'nonsense',
    ])
    expect(readRecentFoods(memoryStorage(stored)).map((r) => r.food.sourceId)).toEqual(['1'])
  })

  it('treats unreadable or missing storage as an empty list', () => {
    expect(readRecentFoods(memoryStorage('{not json'))).toEqual([])
    expect(readRecentFoods(memoryStorage('{"a": 1}'))).toEqual([])
    expect(readRecentFoods(undefined)).toEqual([])
  })

  it('still returns the list when storage refuses to save', () => {
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new Error('full')
      },
    }
    expect(rememberFood({ food: food('1'), unitName: 'g', quantity: 1 }, blocked)).toHaveLength(1)
  })
})
