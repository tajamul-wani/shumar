import { describe, expect, it, vi } from 'vitest'
import { LogError, type FoodAmount } from './logs.ts'
import {
  MAX_SAVED_MEAL_FOODS,
  addSavedMealFood,
  fetchSavedMeals,
  normalizeSavedMealName,
  parseSavedMeal,
  removeSavedMeal,
  removeSavedMealFood,
  saveMeal,
  type SavedMeal,
} from './savedMeals.ts'

// Made-up foods with easy numbers for checking the code, not nutrition data.
const tea: FoodAmount = {
  foodName: 'Test tea',
  foodSource: 'kashmiri',
  foodSourceId: 'k1',
  quantity: 2,
  unitName: 'cup',
  grams: 300,
  nutrients: { kcal: 90, protein: 3, carbs: 9, fat: 4.5, sodiumMg: 600 },
}
const bread: FoodAmount = {
  ...tea,
  foodName: 'Test bread',
  foodSourceId: 'k2',
  quantity: 1,
  unitName: 'piece',
  grams: 90,
}

function foodRow(food: FoodAmount, position: number) {
  return {
    id: `f${position}`,
    position,
    food_name: food.foodName,
    food_source: food.foodSource,
    food_source_id: food.foodSourceId,
    quantity: String(food.quantity),
    unit_name: food.unitName,
    grams: String(food.grams),
    kcal: String(food.nutrients.kcal),
    protein: String(food.nutrients.protein),
    carbs: String(food.nutrients.carbs),
    fat: String(food.nutrients.fat),
    sodium_mg: String(food.nutrients.sodiumMg),
  }
}

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** A stand-in for the Supabase client: each table answers with its own queue of results and records its calls. */
function fakeClient(results: Record<string, Result[]>) {
  const calls: { table: string; name: string; args: unknown[] }[] = []
  const from = vi.fn<(table: string) => unknown>((table) => {
    const result = results[table]?.shift() ?? { data: null, error: { message: 'no result queued' } }
    const query: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    }
    for (const name of ['select', 'eq', 'order', 'single', 'delete', 'insert']) {
      query[name] = (...args: unknown[]) => {
        calls.push({ table, name, args })
        return query
      }
    }
    return query
  })
  return { client: { from } as unknown as Parameters<typeof fetchSavedMeals>[0], calls }
}

describe('normalizeSavedMealName', () => {
  it('trims and collapses spaces, and refuses an empty or too long name', () => {
    expect(normalizeSavedMealName('  Morning   chai ')).toBe('Morning chai')
    expect(normalizeSavedMealName('   ')).toBeNull()
    expect(normalizeSavedMealName('x'.repeat(41))).toBeNull()
    expect(normalizeSavedMealName('x'.repeat(40))).toBe('x'.repeat(40))
  })
})

describe('parseSavedMeal', () => {
  it('reads a meal with its foods in position order', () => {
    const meal = parseSavedMeal({
      id: 'm1',
      name: 'Morning chai',
      saved_meal_foods: [foodRow(bread, 2), foodRow(tea, 1)],
    })
    expect(meal?.name).toBe('Morning chai')
    expect(meal?.foods.map((food) => food.foodName)).toEqual(['Test tea', 'Test bread'])
    expect(meal?.foods[0]).toMatchObject({ id: 'f1', position: 1, nutrients: { kcal: 90 } })
  })

  it('drops a food that fails the limits, and a meal left with none', () => {
    const meal = parseSavedMeal({
      id: 'm1',
      name: 'x',
      saved_meal_foods: [foodRow(tea, 1), { ...foodRow(bread, 2), kcal: '-1' }],
    })
    expect(meal?.foods).toHaveLength(1)
    expect(
      parseSavedMeal({ id: 'm1', name: 'x', saved_meal_foods: [{ ...foodRow(bread, 1), kcal: '-1' }] }),
    ).toBeNull()
    expect(parseSavedMeal({ id: 'm1', name: 'x', saved_meal_foods: [] })).toBeNull()
    expect(
      parseSavedMeal({ id: 'm1', name: 'x', saved_meal_foods: [{ ...foodRow(tea, 1), id: '' }] }),
    ).toBeNull()
    expect(parseSavedMeal({ id: '', name: 'x', saved_meal_foods: [foodRow(tea, 1)] })).toBeNull()
  })
})

describe('fetchSavedMeals', () => {
  it('reads the meals with their foods, by name', async () => {
    const { client, calls } = fakeClient({
      saved_meals: [
        {
          data: [{ id: 'm1', name: 'Morning chai', saved_meal_foods: [foodRow(tea, 1)] }, { id: 'bad' }],
          error: null,
        },
      ],
    })
    const meals = await fetchSavedMeals(client)
    expect(meals.map((meal) => meal.name)).toEqual(['Morning chai'])
    expect(calls.find((call) => call.name === 'order')?.args).toEqual(['name'])
  })

  it('explains a failed read', async () => {
    const { client } = fakeClient({ saved_meals: [{ data: null, error: { message: 'down' } }] })
    await expect(fetchSavedMeals(client)).rejects.toThrow(LogError)
  })
})

describe('saveMeal', () => {
  it('creates the meal, then its foods in order', async () => {
    const { client, calls } = fakeClient({
      saved_meals: [{ data: { id: 'm1' }, error: null }],
      saved_meal_foods: [{ data: [{ id: 'f1' }, { id: 'f2' }], error: null }],
    })
    const meal = await saveMeal(client, ' Morning  chai ', [tea, bread])
    expect(meal).toEqual({
      id: 'm1',
      name: 'Morning chai',
      foods: [
        { id: 'f1', position: 1, ...tea },
        { id: 'f2', position: 2, ...bread },
      ],
    })
    expect(calls[0]).toEqual({ table: 'saved_meals', name: 'insert', args: [{ name: 'Morning chai' }] })
    const foods = calls.find((call) => call.table === 'saved_meal_foods' && call.name === 'insert')
    expect(foods?.args[0]).toMatchObject([
      { saved_meal_id: 'm1', position: 1, food_name: 'Test tea', kcal: 90 },
      { saved_meal_id: 'm1', position: 2, food_name: 'Test bread' },
    ])
  })

  it('gives each saved food its own id, never the id of the logged food it came from', async () => {
    const { client } = fakeClient({
      saved_meals: [{ data: { id: 'm1' }, error: null }],
      saved_meal_foods: [{ data: [{ id: 'f1' }], error: null }],
    })
    const logged = {
      ...tea,
      id: 'log-9',
      logDate: '2026-10-26',
      loggedAt: '2026-10-26T03:00:00Z',
      meal: 'breakfast',
    }
    const meal = await saveMeal(client, 'Morning chai', [logged])
    expect(meal.foods[0]).toEqual({ id: 'f1', position: 1, ...tea })
  })

  it('refuses a bad name, no foods or too many, before any request', async () => {
    const { client, calls } = fakeClient({})
    await expect(saveMeal(client, '  ', [tea])).rejects.toThrow(
      'Give the meal a name of up to 40 characters.',
    )
    await expect(saveMeal(client, 'x', [])).rejects.toThrow('Add a food to the meal first.')
    await expect(saveMeal(client, 'x', Array(MAX_SAVED_MEAL_FOODS + 1).fill(tea))).rejects.toThrow(
      'up to 30 foods',
    )
    expect(calls).toEqual([])
  })

  it('says when the name is already taken', async () => {
    const { client } = fakeClient({ saved_meals: [{ data: null, error: { message: 'dup', code: '23505' } }] })
    await expect(saveMeal(client, 'Morning chai', [tea])).rejects.toThrow(
      'You already have a saved meal called Morning chai.',
    )
  })

  it('removes the meal again when its foods cannot be saved', async () => {
    const { client, calls } = fakeClient({
      saved_meals: [
        { data: { id: 'm1' }, error: null },
        { data: null, error: null },
      ],
      saved_meal_foods: [{ data: null, error: { message: 'down' } }],
    })
    await expect(saveMeal(client, 'Morning chai', [tea])).rejects.toThrow("We couldn't save this meal.")
    expect(calls.filter((call) => call.table === 'saved_meals' && call.name === 'delete')).toHaveLength(1)
  })
})

describe('removeSavedMeal', () => {
  it('deletes the meal by id', async () => {
    const { client, calls } = fakeClient({ saved_meals: [{ data: [{ id: 'm1' }], error: null }] })
    await removeSavedMeal(client, 'm1')
    expect(calls.map((call) => call.name)).toEqual(['delete', 'eq', 'select'])
  })

  it('fails when nothing was removed', async () => {
    const { client } = fakeClient({ saved_meals: [{ data: [], error: null }] })
    await expect(removeSavedMeal(client, 'm1')).rejects.toThrow(LogError)
  })
})

const saved: SavedMeal = {
  id: 'm1',
  name: 'Morning chai',
  foods: [
    { id: 'f1', position: 1, ...tea },
    { id: 'f3', position: 3, ...bread },
  ],
}

describe('addSavedMealFood', () => {
  it('puts the food after the highest place, so a removed place is never reused', async () => {
    const { client, calls } = fakeClient({ saved_meal_foods: [{ data: { id: 'f4' }, error: null }] })
    const meal = await addSavedMealFood(client, saved, tea)
    expect(calls[0].args[0]).toMatchObject({ saved_meal_id: 'm1', position: 4, food_name: 'Test tea' })
    expect(meal.foods.map((food) => food.id)).toEqual(['f1', 'f3', 'f4'])
    expect(meal.foods[2].position).toBe(4)
  })

  it('refuses a 31st food before any request, and explains a failed add', async () => {
    const full = {
      ...saved,
      foods: Array.from({ length: MAX_SAVED_MEAL_FOODS }, (_, i) => ({
        id: `f${i}`,
        position: i + 1,
        ...tea,
      })),
    }
    const { client, calls } = fakeClient({ saved_meal_foods: [{ data: null, error: { message: 'down' } }] })
    await expect(addSavedMealFood(client, full, tea)).rejects.toThrow('up to 30 foods')
    expect(calls).toEqual([])
    await expect(addSavedMealFood(client, saved, tea)).rejects.toThrow(
      "We couldn't add this food to Morning chai.",
    )
  })
})

describe('removeSavedMealFood', () => {
  it('removes one food and keeps the rest', async () => {
    const { client, calls } = fakeClient({ saved_meal_foods: [{ data: [{ id: 'f3' }], error: null }] })
    const meal = await removeSavedMealFood(client, saved, 'f3')
    expect(meal?.foods.map((food) => food.id)).toEqual(['f1'])
    expect(calls.map((call) => call.name)).toEqual(['delete', 'eq', 'select'])
    expect(calls[1].args).toEqual(['id', 'f3'])
  })

  it('removes the whole saved meal with its last food', async () => {
    const { client, calls } = fakeClient({ saved_meals: [{ data: [{ id: 'm1' }], error: null }] })
    const meal = await removeSavedMealFood(client, { ...saved, foods: [saved.foods[0]] }, 'f1')
    expect(meal).toBeNull()
    expect(calls[0].table).toBe('saved_meals')
  })

  it('explains a failed remove', async () => {
    const { client } = fakeClient({ saved_meal_foods: [{ data: [], error: null }] })
    await expect(removeSavedMealFood(client, saved, 'f1')).rejects.toThrow(
      "We couldn't remove this food from Morning chai.",
    )
  })
})
