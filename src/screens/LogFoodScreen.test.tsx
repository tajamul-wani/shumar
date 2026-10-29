import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AppClient } from '../auth/context.ts'
import { parseResults } from '../lib/foodSearch.ts'
import { RECENT_FOODS_KEY, rememberFood } from '../lib/recentFoods.ts'
import { LogSheet } from '../log/LogSheet.tsx'
import { LogFoodScreen } from './LogFoodScreen.tsx'

// Made-up foods with easy numbers for checking the screen, not nutrition data.
const rice = {
  source: 'usda',
  source_id: '1001',
  name: 'Test rice, cooked',
  kcal_per_100g: 130,
  protein_per_100g: 2.5,
  carbs_per_100g: 28,
  fat_per_100g: 0.3,
  sodium_mg_per_100g: 1,
  flagged: false,
  verified: true,
  units: [{ name: '1 cup', grams: 160 }],
}
const stew = { ...rice, source_id: '1002', name: 'Test stew', flagged: true, units: [] }
const dish = { ...rice, source: 'kashmiri', source_id: 'k1', name: 'Test dish', units: [] }

// A food of the person's own, as my_foods and search_foods give it: 300 kcal per 100 g, 30 g a serving.
const cheeseRow = {
  id: 'm1',
  name: 'Test cheese',
  brand: 'Test brand',
  label_basis: 'serving',
  serving_grams: '30',
  kcal: '90',
  protein: '6',
  carbs: '0.6',
  fat: '7.2',
  sodium_mg: '6',
}
const cheese = {
  ...rice,
  source: 'mine',
  source_id: 'm1',
  name: 'Test cheese (Test brand)',
  kcal_per_100g: 300,
  protein_per_100g: 20,
  carbs_per_100g: 2,
  fat_per_100g: 24,
  sodium_mg_per_100g: 20,
  units: [{ name: '1 serving', grams: 30 }],
}

function fakeClient(
  options: {
    rows?: unknown[]
    searchFails?: boolean
    saveFails?: boolean
    /** The person's own foods, and what saving or changing one answers with. */
    myFoods?: unknown[]
    savedFood?: unknown
  } = {},
) {
  const rpc = vi.fn<(name: string, args: Record<string, unknown>) => unknown>(() => {
    const response = Promise.resolve(
      options.searchFails
        ? { data: null, error: { message: 'offline' } }
        : { data: options.rows ?? [rice], error: null },
    )
    return Object.assign(response, { abortSignal: () => response })
  })
  const insert = vi.fn<(row: unknown) => Promise<unknown>>(async () => ({
    error: options.saveFails ? { message: 'offline' } : null,
  }))
  const myFoodCalls: string[] = []
  // Reads (yesterday's logs, saved meals) find nothing; the tests here are about adding food.
  const from = vi.fn<(table: string) => unknown>((table) => {
    if (table === 'my_foods') {
      const list = Promise.resolve({ data: options.myFoods ?? [], error: null })
      const one = Promise.resolve({ data: options.savedFood ?? null, error: null })
      const query: Record<string, unknown> = { then: list.then.bind(list) }
      for (const name of ['select', 'eq', 'order', 'insert', 'update', 'delete']) {
        query[name] = () => {
          myFoodCalls.push(name)
          return query
        }
      }
      query.single = () => one
      query.maybeSingle = () => one
      return query
    }
    const empty = Promise.resolve({ data: [], error: null })
    const query: Record<string, unknown> = { insert, then: empty.then.bind(empty) }
    for (const name of ['select', 'eq', 'order']) query[name] = () => query
    return query
  })
  return { client: { auth: {}, rpc, from } as unknown as AppClient, rpc, insert, from, myFoodCalls }
}

/** No saved meals, and nothing to save them with: the sheet's own flows are what is tested here. */
const noSavedMeals = {
  meals: [],
  save: vi.fn<() => Promise<never>>(),
  remove: vi.fn<() => Promise<void>>(),
  addFood: vi.fn<() => Promise<never>>(),
  removeFood: vi.fn<() => Promise<null>>(),
}

function renderScreen(fake = fakeClient()) {
  render(
    <AuthContext.Provider value={{ client: fake.client, session: null, loading: false }}>
      <main id="main">
        <LogFoodScreen />
      </main>
    </AuthContext.Provider>,
  )
  return fake
}

async function searchFor(text: string) {
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search foods' }), text)
}

async function openFood(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }))
}

const heading = () => screen.getByRole('heading', { level: 1 })

beforeEach(() => {
  // 8 pm on 21 October 2026: the sheet opens on dinner. Only the clock is faked; timers stay real.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 21, 20, 0))
})

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

describe('choosing the meal', () => {
  it('opens on the meal for the time of day and can change it', async () => {
    renderScreen()
    expect(heading()).toHaveTextContent('Add food')
    expect(screen.getByText('Search for a food to add it to dinner.')).toBeInTheDocument()

    // The meal is on its button, so the header fits on one line on small phones.
    const change = screen.getByRole('button', { name: 'To dinner, change meal' })
    expect(change).toHaveTextContent('To dinner')
    await userEvent.click(change)
    expect(change).toHaveAttribute('aria-expanded', 'true')
    const meals = screen.getByRole('group', { name: 'Meal' })
    expect(
      within(meals)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Breakfast', 'Lunch', 'Evening tea', 'Dinner', 'Snack'])
    expect(within(meals).getByRole('button', { name: 'Dinner' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(within(meals).getByRole('button', { name: 'Evening tea' }))
    expect(change).toHaveAccessibleName('To evening tea, change meal')
    expect(screen.queryByRole('group', { name: 'Meal' })).not.toBeInTheDocument()
    expect(change).toHaveFocus()
  })

  it('closes back to Today', () => {
    renderScreen()
    expect(screen.getByRole('link', { name: 'Close' })).toHaveAttribute('href', '/')
  })
})

describe('searching', () => {
  it('searches once typing pauses and lists what it finds', async () => {
    const { rpc } = renderScreen()
    await searchFor('Rice')
    const results = await screen.findByRole('list', { name: 'Search results' })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('search_foods', { query: 'rice', max_results: 20 })
    // A weighed food reads per 100 g, protein first, with no tag: USDA foods need none.
    expect(within(results).getByRole('listitem')).toHaveTextContent(
      'Test rice, cooked2.5 g protein · 130 kcal · 100 g',
    )
    expect(screen.getByText('Tap a food to see all its values and choose how much.')).toBeInTheDocument()
    expect(screen.getByText('1 food found')).toBeInTheDocument()
  })

  it('clears the search and goes back to the start', async () => {
    renderScreen()
    await searchFor('rice')
    await screen.findByRole('list', { name: 'Search results' })
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    const box = screen.getByRole('searchbox', { name: 'Search foods' })
    expect(box).toHaveValue('')
    expect(box).toHaveFocus()
    expect(screen.getByText('Search for a food to add it to dinner.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('says when nothing matches, and offers to add the food from its pack', async () => {
    renderScreen(fakeClient({ rows: [] }))
    await searchFor('zz')
    expect(await screen.findAllByText('No foods match "zz".')).not.toHaveLength(0)
    expect(
      screen.getByText('Add zz with the values printed on its label. Only you will see it.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add it from the pack' }))
    expect(heading()).toHaveTextContent('Add a food from its pack')
    expect(heading()).toHaveFocus()
    expect(screen.getByLabelText('Name')).toHaveValue('zz')
    await userEvent.click(screen.getByRole('button', { name: 'Back to search' }))
    expect(screen.getByRole('searchbox', { name: 'Search foods' })).toHaveValue('zz')
  })

  it('saves a food from its pack, then finds it first', async () => {
    const fake = renderScreen(fakeClient({ rows: [cheese], savedFood: cheeseRow }))
    await searchFor('cheese')
    await userEvent.click(
      await screen.findByRole('button', { name: 'Not the one? Add another from the pack' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Per serving' }))
    for (const [label, value] of [
      ['Name', 'Test cheese'],
      ['Brand', 'Test brand'],
      ['One serving is', '30'],
      ['Calories', '90'],
      ['Protein', '6'],
      ['Carbs', '0.6'],
      ['Fat', '7.2'],
      ['Sodium', '6'],
    ]) {
      await userEvent.clear(screen.getByLabelText(label))
      await userEvent.type(screen.getByLabelText(label), value)
    }
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }))
    expect(fake.myFoodCalls).toContain('insert')
    expect(await screen.findByRole('searchbox', { name: 'Search foods' })).toHaveValue('Test cheese')
    expect(await screen.findByRole('button', { name: /^Test cheese \(Test brand\)/ })).toHaveTextContent(
      'Yours',
    )
    expect(screen.getByText('Saved to your foods')).toBeInTheDocument()
  })

  it('offers another food from its pack under the results', async () => {
    renderScreen()
    await searchFor('rice')
    await userEvent.click(
      await screen.findByRole('button', { name: 'Not the one? Add another from the pack' }),
    )
    expect(heading()).toHaveTextContent('Add a food from its pack')
  })

  it('explains when the search fails', async () => {
    renderScreen(fakeClient({ searchFails: true }))
    await searchFor('rice')
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't search right now")
  })

  it('marks estimates and confirmed Kashmiri dishes', async () => {
    renderScreen(fakeClient({ rows: [stew, dish] }))
    await searchFor('test')
    const rows = within(await screen.findByRole('list', { name: 'Search results' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('2.5 g protein · about 130 kcal · 100 g Estimate')
    expect(rows[1]).toHaveTextContent('2.5 g protein · 130 kcal · 100 g Kashmiri Verified')
  })
})

describe('a chosen food', () => {
  it('works out the values for the amount and adds it to the meal', async () => {
    const { insert } = renderScreen()
    await searchFor('rice')
    await openFood('Test rice, cooked')

    expect(heading()).toHaveTextContent('Test rice, cooked')
    expect(heading()).toHaveFocus()
    const units = screen.getByRole('group', { name: 'Unit' })
    expect(
      within(units)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['1 cup', 'Grams'])
    // A USDA food that is weighed starts on grams.
    expect(within(units).getByRole('button', { name: 'Grams' })).toHaveAttribute('aria-pressed', 'true')
    const quantity = screen.getByRole('textbox', { name: 'Quantity' })
    expect(quantity).toHaveValue('100')
    expect(screen.getByText('130')).toBeInTheDocument()

    await userEvent.click(within(units).getByRole('button', { name: '1 cup' }))
    expect(quantity).toHaveValue('1')
    expect(quantity).toHaveAccessibleDescription('1 cup is 160 g')
    expect(screen.getByText('208')).toBeInTheDocument()
    expect(screen.getByText('Protein').nextSibling).toHaveTextContent('4 g')
    expect(screen.getByText('Carbs').nextSibling).toHaveTextContent('44.8 g')
    expect(screen.getByText('Fat').nextSibling).toHaveTextContent('0.5 g')

    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    expect(quantity).toHaveValue('1.5')
    expect(screen.getByText('312')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Add to dinner' }))
    expect(insert).toHaveBeenCalledWith({
      log_date: '2026-10-21',
      meal: 'dinner',
      food_name: 'Test rice, cooked',
      food_source: 'usda',
      food_source_id: '1001',
      quantity: 1.5,
      unit_name: '1 cup',
      grams: 240,
      kcal: 312,
      protein: 6,
      carbs: 67.2,
      fat: 0.72,
      sodium_mg: 2.4,
    })
    expect(heading()).toHaveTextContent('Add food')
    expect(heading()).toHaveFocus()
    expect(screen.getByText('Added to dinner')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search foods' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add 1.5 cups Test rice, cooked' })).toBeInTheDocument()
    expect(localStorage.getItem(RECENT_FOODS_KEY)).toContain('Test rice, cooked')
  })

  it('starts grams at 100, steps by 10 and refuses an amount it cannot use', async () => {
    const { insert } = renderScreen()
    await searchFor('rice')
    await openFood('Test rice, cooked')
    await userEvent.click(screen.getByRole('button', { name: '1 cup' }))
    await userEvent.click(screen.getByRole('button', { name: 'Grams' }))
    const quantity = screen.getByRole('textbox', { name: 'Quantity' })
    expect(quantity).toHaveValue('100')
    expect(quantity).not.toHaveAccessibleDescription()
    await userEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }))
    expect(quantity).toHaveValue('90')
    expect(screen.getByText('117')).toBeInTheDocument()

    await userEvent.clear(quantity)
    await userEvent.type(quantity, 'lots')
    expect(screen.getByText('Enter an amount to see the values.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Add to dinner' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount more than 0 and up to 10,000.')
    expect(insert).not.toHaveBeenCalled()
  })

  it('shows the first few units as chips, with the rest on request, and grams always', async () => {
    // Ounces and pounds are left out: grams cover them.
    const units = ['1 slice', '1 slice, thin', '1 oz', '1 cup, diced', '1 cup, cubes', '1 cup, crumbs'].map(
      (name, i) => ({
        name,
        grams: 10 + i,
      }),
    )
    renderScreen(fakeClient({ rows: [{ ...rice, units }] }))
    await searchFor('rice')
    await openFood('Test rice, cooked')
    expect(screen.queryByRole('combobox', { name: 'Unit' })).not.toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'Unit' })
    const names = () =>
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent)
    expect(names()).toEqual([
      '1 slice',
      '1 slice, thin',
      '1 cup, diced',
      '1 cup, cubes',
      'Grams',
      '1 more units',
    ])
    await userEvent.click(within(group).getByRole('button', { name: '1 more units' }))
    expect(names()).toEqual([
      '1 slice',
      '1 slice, thin',
      '1 cup, diced',
      '1 cup, cubes',
      '1 cup, crumbs',
      'Grams',
    ])
    await userEvent.click(within(group).getByRole('button', { name: '1 slice' }))
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveValue('1')
    await userEvent.click(within(group).getByRole('button', { name: 'Grams' }))
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveValue('100')
  })

  it('adds with the Enter key from the amount', async () => {
    const { insert } = renderScreen()
    await searchFor('rice')
    await openFood('Test rice, cooked')
    await userEvent.click(screen.getByRole('button', { name: '1 cup' }))
    const quantity = screen.getByRole('textbox', { name: 'Quantity' })
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '0,5{Enter}')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ quantity: 0.5, grams: 80 }))
  })

  it('stays open and explains when saving fails', async () => {
    renderScreen(fakeClient({ saveFails: true }))
    await searchFor('rice')
    await openFood('Test rice, cooked')
    await userEvent.click(screen.getByRole('button', { name: 'Add to dinner' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't save this food. Check your connection and try again.",
    )
    expect(heading()).toHaveTextContent('Test rice, cooked')
    expect(screen.getByRole('button', { name: 'Add to dinner' })).toBeEnabled()
  })

  it('explains an estimate and links to how values are worked out', async () => {
    renderScreen(fakeClient({ rows: [stew] }))
    await searchFor('stew')
    await openFood('Test stew')
    expect(screen.getByText('Estimate, these values may be off')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How this is calculated' })).toHaveAttribute('href', '/sources')
    expect(screen.getByText('about')).toBeInTheDocument()
  })

  it('goes back to the same results without searching again', async () => {
    const { rpc } = renderScreen()
    await searchFor('rice')
    await openFood('Test rice, cooked')
    await userEvent.click(screen.getByRole('button', { name: 'Back to search' }))
    expect(heading()).toHaveTextContent('Add food')
    expect(heading()).toHaveFocus()
    expect(screen.getByRole('list', { name: 'Search results' })).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('recent foods', () => {
  beforeEach(() => {
    const [food] = parseResults([rice])
    rememberFood({ food, unitName: '1 cup', quantity: 2 })
  })

  it('adds a recent food again in one tap, with the amount used last time', async () => {
    const { insert } = renderScreen()
    const recent = screen.getByRole('region', { name: 'Recent' })
    expect(within(recent).getByRole('listitem')).toHaveTextContent('8 g protein · 416 kcal · 2 cups (320 g)')
    await userEvent.click(within(recent).getByRole('button', { name: 'Add 2 cups Test rice, cooked' }))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2, kcal: 416, meal: 'dinner' }))
    expect(screen.getByText('Added to dinner')).toBeInTheDocument()
  })

  it('opens a recent food on its last amount', async () => {
    renderScreen()
    await openFood('Test rice, cooked')
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveValue('2')
  })

  it('shows a failed quick add on the search view', async () => {
    renderScreen(fakeClient({ saveFails: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Add 2 cups Test rice, cooked' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save this food.")
  })
})

describe('inside another screen', () => {
  function renderEmbedded(onAdded = vi.fn<() => void>(), fake = fakeClient()) {
    render(
      <AuthContext.Provider value={{ client: fake.client, session: null, loading: false }}>
        <main id="main">
          <h1 tabIndex={-1}>Today</h1>
          <section aria-label="Add food">
            <LogSheet embedded onAdded={onAdded} savedMeals={noSavedMeals} />
          </section>
        </main>
      </AuthContext.Provider>,
    )
    return { onAdded, ...fake }
  }

  it('is a section titled Add food, with the meal on its button and no close button', async () => {
    renderEmbedded()
    expect(screen.getByRole('heading', { level: 2, name: 'Add food' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Close' })).not.toBeInTheDocument()
    const change = screen.getByRole('button', { name: 'To dinner, change meal' })
    expect(change).toHaveTextContent('To dinner')
    await userEvent.click(change)
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Meal' })).getByRole('button', { name: 'Lunch' }),
    )
    expect(screen.getByRole('button', { name: 'To lunch, change meal' })).toHaveFocus()
  })

  it("keeps focus inside the sheet instead of the page's heading", async () => {
    renderEmbedded()
    await searchFor('rice')
    await openFood('Test rice, cooked')
    expect(screen.getByRole('heading', { level: 2, name: 'Test rice, cooked' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Back to search' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Add food' })).toHaveFocus()
  })

  it('tells the screen around it when a food is added', async () => {
    const [food] = parseResults([rice])
    rememberFood({ food, unitName: '1 cup', quantity: 1 })
    const { onAdded, insert } = renderEmbedded()
    expect(screen.getByRole('heading', { level: 3, name: 'Recent' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 cup Test rice, cooked' }))
    expect(insert).toHaveBeenCalled()
    expect(onAdded).toHaveBeenCalledTimes(1)
  })
})

describe("the person's own foods", () => {
  it('are listed before any search, and one is added in a tap', async () => {
    const fake = renderScreen(fakeClient({ myFoods: [cheeseRow] }))
    expect(await screen.findByRole('heading', { name: 'Your foods' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 serving Test cheese (Test brand)' }))
    expect(fake.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        food_source: 'mine',
        food_source_id: 'm1',
        unit_name: '1 serving',
        grams: 30,
        kcal: 90,
      }),
    )
  })

  it('open with Edit and Remove, and Edit shows the label as it was typed', async () => {
    renderScreen(fakeClient({ myFoods: [cheeseRow] }))
    await openFood('Test cheese')
    expect(heading()).toHaveTextContent('Test cheese (Test brand)')
    expect(screen.getByText('Your food, from its pack')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(heading()).toHaveTextContent('Change your food')
    expect(screen.getByLabelText('One serving is')).toHaveValue('30')
    expect(screen.getByLabelText('Calories')).toHaveValue('90')
    await userEvent.click(screen.getByRole('button', { name: 'Back to search' }))
    expect(heading()).toHaveTextContent('Test cheese (Test brand)')
  })

  it('can be removed, which goes back to the search', async () => {
    const fake = renderScreen(fakeClient({ myFoods: [cheeseRow] }))
    await openFood('Test cheese')
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(fake.myFoodCalls).toContain('delete')
    expect(await screen.findByRole('searchbox', { name: 'Search foods' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your foods' })).not.toBeInTheDocument()
  })
})
