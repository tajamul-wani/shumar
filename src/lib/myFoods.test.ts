import { describe, expect, it, vi } from 'vitest'
import { LogError } from './logs.ts'
import {
  EMPTY_DRAFT,
  MAX_BRAND,
  MAX_MY_FOOD_NAME,
  SERVING_UNIT,
  caloriesMismatch,
  createMyFood,
  displayName,
  fetchMyFoods,
  oneLine,
  parseMyFood,
  per100g,
  readDraft,
  removeMyFood,
  toDraft,
  toFoodResult,
  updateMyFood,
  type MyFood,
  type MyFoodDraft,
} from './myFoods.ts'

// Made-up foods with easy numbers for checking the code, not nutrition data.
const cheese: MyFood = {
  id: 'm1',
  name: 'Test cheese',
  brand: 'Test brand',
  basis: '100g',
  servingGrams: null,
  label: { kcal: 300, protein: 20, carbs: 2, fat: 24, sodiumMg: 20 },
}
const crackers: MyFood = {
  id: 'm2',
  name: 'Test crackers',
  brand: null,
  basis: 'serving',
  servingGrams: 25,
  label: { kcal: 120, protein: 2, carbs: 16, fat: 5, sodiumMg: 200 },
}

const filled: MyFoodDraft = {
  ...EMPTY_DRAFT,
  name: '  Test   cheese ',
  brand: ' Test brand ',
  kcal: '300',
  protein: '20',
  carbs: '2',
  fat: '24',
  sodiumMg: '20',
}

function row(food: MyFood) {
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    label_basis: food.basis,
    serving_grams: food.servingGrams === null ? null : String(food.servingGrams),
    kcal: String(food.label.kcal),
    protein: String(food.label.protein),
    carbs: String(food.label.carbs),
    fat: String(food.label.fat),
    sodium_mg: String(food.label.sodiumMg),
  }
}

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** A stand-in for the Supabase client: answers each query with the next queued result and records its calls. */
function fakeClient(results: Result[]) {
  const calls: { name: string; args: unknown[] }[] = []
  const from = vi.fn<(table: string) => unknown>((table) => {
    calls.push({ name: 'from', args: [table] })
    const result = results.shift() ?? { data: null, error: { message: 'no result queued' } }
    const query: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    }
    for (const name of ['select', 'order', 'insert', 'update', 'delete', 'eq', 'single', 'maybeSingle']) {
      query[name] = (...args: unknown[]) => {
        calls.push({ name, args })
        return query
      }
    }
    return query
  })
  return { client: { from } as unknown as Parameters<typeof fetchMyFoods>[0], calls }
}

describe('reading the form', () => {
  it('reads a food whose label gives values per 100 g, tidying the name and brand', () => {
    expect(readDraft(filled)).toEqual({
      food: {
        name: 'Test cheese',
        brand: 'Test brand',
        basis: '100g',
        servingGrams: null,
        label: { kcal: 300, protein: 20, carbs: 2, fat: 24, sodiumMg: 20 },
      },
      problems: null,
    })
  })

  it('reads values per serving with the serving size, a comma for a decimal point, zeros, and no brand', () => {
    const check = readDraft({
      ...filled,
      brand: '   ',
      basis: 'serving',
      servingGrams: '25',
      kcal: '120',
      protein: '2,5',
      carbs: '16',
      fat: '0',
      sodiumMg: '1,000',
    })
    expect(check.food).toEqual({
      name: 'Test cheese',
      brand: null,
      basis: 'serving',
      servingGrams: 25,
      label: { kcal: 120, protein: 2.5, carbs: 16, fat: 0, sodiumMg: 1000 },
    })
  })

  it('asks for every value from the label, and never fills one in', () => {
    expect(readDraft(EMPTY_DRAFT).problems).toEqual({
      name: 'Give the food a name.',
      kcal: 'Enter the calories from the label.',
      protein: 'Enter the protein from the label.',
      carbs: 'Enter the carbs from the label.',
      fat: 'Enter the fat from the label.',
      sodiumMg: 'Enter the sodium from the label.',
    })
  })

  it('refuses a value that is not a number, and names that are too long', () => {
    const problems = readDraft({
      ...filled,
      name: 'x'.repeat(MAX_MY_FOOD_NAME + 1),
      brand: 'y'.repeat(MAX_BRAND + 1),
      fat: 'about 2',
    }).problems
    expect(problems).toEqual({
      name: `Keep the name to ${MAX_MY_FOOD_NAME} characters.`,
      brand: `Keep the brand to ${MAX_BRAND} characters.`,
      fat: 'Use a number, such as 12.5.',
    })
  })

  it('needs the grams in a serving when the values are per serving', () => {
    for (const servingGrams of ['', '0', '5001', 'some']) {
      expect(readDraft({ ...filled, basis: 'serving', servingGrams }).problems).toEqual({
        servingGrams: 'Enter the grams in one serving, as the label gives them.',
      })
    }
  })

  it('refuses values no food can have per 100 g', () => {
    expect(readDraft({ ...filled, kcal: '1001' }).problems).toEqual({
      kcal: 'That is over 1,000 kcal per 100 g, more than any food has. Check the label.',
    })
    expect(readDraft({ ...filled, protein: '60', carbs: '30', fat: '11' }).problems).toEqual({
      macros: 'Protein, carbs and fat weigh more than the food itself. Check the label.',
    })
    expect(readDraft({ ...filled, sodiumMg: '40001' }).problems).toEqual({
      sodiumMg: 'That is over 40,000 mg of sodium per 100 g. Check that it is in mg.',
    })
    // Per serving, the limits scale with the serving: 30 g of protein, carbs and fat fit a 30 g serving.
    const serving = { ...filled, basis: 'serving' as const, servingGrams: '30' }
    expect(readDraft({ ...serving, kcal: '300', protein: '10', carbs: '10', fat: '10' }).problems).toBeNull()
    expect(readDraft({ ...serving, kcal: '301', protein: '10', carbs: '10', fat: '10' }).problems).toEqual({
      kcal: 'That is over 1,000 kcal per 100 g, more than any food has. Check the label.',
    })
  })

  it('shows a saved food again as the label gave it', () => {
    expect(toDraft(crackers)).toEqual({
      name: 'Test crackers',
      brand: '',
      basis: 'serving',
      servingGrams: '25',
      kcal: '120',
      protein: '2',
      carbs: '16',
      fat: '5',
      sodiumMg: '200',
    })
    expect(toDraft({ ...cheese, label: { ...cheese.label, fat: 24.456 } }).fat).toBe('24.46')
    expect(readDraft(toDraft(crackers)).food).toEqual({
      name: 'Test crackers',
      brand: null,
      basis: 'serving',
      servingGrams: 25,
      label: crackers.label,
    })
  })

  it('keeps names and brands to one tidy line', () => {
    expect(oneLine('  Paneer \n full   fat ')).toBe('Paneer full fat')
  })
})

describe('the values per 100 g', () => {
  it('scale a serving to 100 g, and keep 100 g as it is', () => {
    expect(per100g(crackers)).toEqual({ kcal: 480, protein: 8, carbs: 64, fat: 20, sodiumMg: 800 })
    expect(per100g(cheese)).toEqual(cheese.label)
  })
})

describe('the calories check', () => {
  it('passes values within 20% of what protein, carbs and fat give', () => {
    // 4 x 20 + 4 x 2 + 9 x 24 = 304, against 300 on the label.
    expect(caloriesMismatch(cheese)).toBeNull()
  })

  it('names both numbers as the label states them when they are further apart', () => {
    expect(caloriesMismatch({ ...crackers, label: { ...crackers.label, kcal: 60 } })).toEqual({
      fromMacros: 117,
      entered: 60,
    })
  })
})

describe('a food of their own in search', () => {
  it('reads like any other food, with its brand and its serving', () => {
    expect(displayName(cheese)).toBe('Test cheese (Test brand)')
    expect(displayName(crackers)).toBe('Test crackers')
    expect(toFoodResult(crackers)).toEqual({
      source: 'mine',
      sourceId: 'm2',
      name: 'Test crackers',
      per100g: { kcal: 480, protein: 8, carbs: 64, fat: 20, sodiumMg: 800 },
      units: [
        { name: 'g', grams: 1 },
        { name: SERVING_UNIT, grams: 25 },
      ],
      flagged: false,
      verified: true,
    })
    expect(toFoodResult(cheese).units).toEqual([{ name: 'g', grams: 1 }])
    expect(toFoodResult({ ...cheese, label: { ...cheese.label, kcal: 100 } }).flagged).toBe(true)
  })
})

describe('parseMyFood', () => {
  it('reads rows, including numbers sent as text', () => {
    expect(parseMyFood(row(crackers))).toEqual(crackers)
    expect(parseMyFood(row(cheese))).toEqual(cheese)
  })

  it('drops a row that does not make sense', () => {
    expect(parseMyFood(null)).toBeNull()
    expect(parseMyFood({ ...row(cheese), name: '' })).toBeNull()
    expect(parseMyFood({ ...row(cheese), brand: '' })).toBeNull()
    expect(parseMyFood({ ...row(cheese), label_basis: 'pack' })).toBeNull()
    expect(parseMyFood({ ...row(cheese), serving_grams: '30' })).toBeNull()
    expect(parseMyFood({ ...row(crackers), serving_grams: null })).toBeNull()
    expect(parseMyFood({ ...row(cheese), kcal: '-1' })).toBeNull()
  })
})

describe('reading and saving foods of their own', () => {
  it('reads them by name, leaving out a row that does not make sense', async () => {
    const { client, calls } = fakeClient([{ data: [row(cheese), { id: 'bad' }, row(crackers)], error: null }])
    await expect(fetchMyFoods(client)).resolves.toEqual([cheese, crackers])
    expect(calls).toContainEqual({ name: 'from', args: ['my_foods'] })
    expect(calls).toContainEqual({ name: 'order', args: ['name'] })
  })

  it('reads nothing as an empty list, and explains a failed read', async () => {
    await expect(fetchMyFoods(fakeClient([{ data: null, error: null }]).client)).resolves.toEqual([])
    await expect(
      fetchMyFoods(fakeClient([{ data: null, error: { message: 'offline' } }]).client),
    ).rejects.toThrow("We couldn't load your foods. Check your connection and try again.")
  })

  it('saves a food with its values to two decimal places, as the table keeps them', async () => {
    const { client, calls } = fakeClient([{ data: row(cheese), error: null }])
    const input = { ...cheese, label: { ...cheese.label, fat: 24.004 } }
    await expect(createMyFood(client, input)).resolves.toEqual(cheese)
    expect(calls).toContainEqual({
      name: 'insert',
      args: [
        {
          name: 'Test cheese',
          brand: 'Test brand',
          label_basis: '100g',
          serving_grams: null,
          kcal: 300,
          protein: 20,
          carbs: 2,
          fat: 24,
          sodium_mg: 20,
        },
      ],
    })
  })

  it('explains a save the database refuses', async () => {
    const save = (error: Result['error']) => createMyFood(fakeClient([{ data: null, error }]).client, cheese)
    await expect(save({ message: 'full', code: 'SH005' })).rejects.toThrow(
      'You have 500 foods of your own. Remove one to add another.',
    )
    await expect(save({ message: 'taken', code: '23505' })).rejects.toThrow(
      'You already have Test cheese (Test brand).',
    )
    await expect(save({ message: 'offline' })).rejects.toThrow(
      "We couldn't save this food. Check your connection and try again.",
    )
    await expect(save(null)).rejects.toBeInstanceOf(LogError)
  })

  it('changes a food by its id', async () => {
    const { client, calls } = fakeClient([{ data: row(crackers), error: null }])
    await expect(updateMyFood(client, 'm2', crackers)).resolves.toEqual(crackers)
    expect(calls).toContainEqual({ name: 'eq', args: ['id', 'm2'] })
    expect(calls.some((call) => call.name === 'update')).toBe(true)
    await expect(
      updateMyFood(fakeClient([{ data: null, error: null }]).client, 'm2', crackers),
    ).rejects.toThrow("We couldn't save your changes. Check your connection and try again.")
  })

  it('removes a food by its id', async () => {
    const { client, calls } = fakeClient([{ data: null, error: null }])
    await expect(removeMyFood(client, 'm1')).resolves.toBeUndefined()
    expect(calls).toContainEqual({ name: 'delete', args: [] })
    expect(calls).toContainEqual({ name: 'eq', args: ['id', 'm1'] })
    await expect(
      removeMyFood(fakeClient([{ data: null, error: { message: 'offline' } }]).client, 'm1'),
    ).rejects.toThrow("We couldn't remove this food. Check your connection and try again.")
  })
})
