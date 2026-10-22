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

function fakeClient(options: { rows?: unknown[]; searchFails?: boolean; saveFails?: boolean } = {}) {
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
  const from = vi.fn<(table: string) => unknown>(() => ({ insert }))
  return { client: { auth: {}, rpc, from } as unknown as AppClient, rpc, insert, from }
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
    expect(within(results).getByRole('listitem')).toHaveTextContent(
      'Test rice, cooked1 cup · 208 kcal · Ingredient',
    )
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

  it('says when nothing matches', async () => {
    renderScreen(fakeClient({ rows: [] }))
    await searchFor('zz')
    expect(
      await screen.findAllByText('No foods match "zz". Try another word or a shorter search.'),
    ).not.toHaveLength(0)
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
    expect(rows[0]).toHaveTextContent('100 g · about 130 kcal · Estimate')
    expect(rows[1]).toHaveTextContent('100 g · 130 kcal · KashmiriVerified')
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
    expect(within(units).getByRole('button', { name: '1 cup' })).toHaveAttribute('aria-pressed', 'true')
    const quantity = screen.getByRole('textbox', { name: 'Quantity' })
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
    expect(screen.getByRole('button', { name: 'Add 1.5 × 1 cup Test rice, cooked' })).toBeInTheDocument()
    expect(localStorage.getItem(RECENT_FOODS_KEY)).toContain('Test rice, cooked')
  })

  it('starts grams at 100, steps by 10 and refuses an amount it cannot use', async () => {
    const { insert } = renderScreen()
    await searchFor('rice')
    await openFood('Test rice, cooked')
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

  it('lists many units in a dropdown instead of a wall of chips', async () => {
    const units = ['1 slice', '1 slice, thin', '1 oz', '1 cup, cubes', '1 cup, crumbs'].map((name, i) => ({
      name,
      grams: 10 + i,
    }))
    renderScreen(fakeClient({ rows: [{ ...rice, units }] }))
    await searchFor('rice')
    await openFood('Test rice, cooked')
    expect(screen.queryByRole('group', { name: 'Unit' })).not.toBeInTheDocument()
    const unit = screen.getByRole('combobox', { name: 'Unit' })
    expect(unit).toHaveValue('1 slice')
    expect(
      within(unit)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['1 slice', '1 slice, thin', '1 oz', '1 cup, cubes', '1 cup, crumbs', 'Grams'])
    await userEvent.selectOptions(unit, 'g')
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveValue('100')
  })

  it('adds with the Enter key from the amount', async () => {
    const { insert } = renderScreen()
    await searchFor('rice')
    await openFood('Test rice, cooked')
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
    expect(within(recent).getByRole('listitem')).toHaveTextContent('2 × 1 cup · 416 kcal · Ingredient')
    await userEvent.click(within(recent).getByRole('button', { name: 'Add 2 × 1 cup Test rice, cooked' }))
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
    await userEvent.click(screen.getByRole('button', { name: 'Add 2 × 1 cup Test rice, cooked' }))
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
            <LogSheet embedded onAdded={onAdded} />
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
