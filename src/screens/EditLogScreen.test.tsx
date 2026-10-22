import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AppClient } from '../auth/context.ts'
import { EditLogScreen } from './EditLogScreen.tsx'

// A made-up log with easy numbers for checking the screen, not nutrition data.
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    log_date: '2026-10-21',
    logged_at: '2026-10-21T03:10:00+00:00',
    meal: 'breakfast',
    food_name: 'Test tea',
    food_source: 'kashmiri',
    food_source_id: 'k1',
    quantity: 1,
    unit_name: 'cup',
    grams: 150,
    kcal: 45,
    protein: 1.5,
    carbs: 4.5,
    fat: 2.25,
    sodium_mg: 300,
    ...overrides,
  }
}

type Result = { data: unknown; error: { message: string } | null }

/** Answers each query with the next result in turn and records what each query asked for. */
function fakeClient(...results: Result[]) {
  const queries: [string, unknown[]][][] = []
  const from = vi.fn<(table: string) => unknown>(() => {
    const calls: [string, unknown[]][] = []
    queries.push(calls)
    const result = results.shift() ?? { data: null, error: { message: 'no more results' } }
    const query: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    }
    for (const name of ['select', 'eq', 'maybeSingle', 'update']) {
      query[name] = (...args: unknown[]) => {
        calls.push([name, args])
        return query
      }
    }
    return query
  })
  return { client: { auth: {}, from } as unknown as AppClient, queries }
}

function renderScreen(fake: ReturnType<typeof fakeClient>) {
  window.history.replaceState(null, '', '/log/edit/log-1')
  render(
    <AuthContext.Provider value={{ client: fake.client, session: null, loading: false }}>
      <main id="main">
        <EditLogScreen id="log-1" />
      </main>
    </AuthContext.Provider>,
  )
  return fake
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('changing a logged food', () => {
  it('opens the food on its logged amount, unit and meal, and focuses it', async () => {
    renderScreen(fakeClient({ data: row(), error: null }))
    const heading = await screen.findByRole('heading', { level: 1, name: 'Test tea' })
    // Focus moves once the food has drawn, a moment after it appears.
    await waitFor(() => expect(heading).toHaveFocus())
    expect(document.title).toBe('Edit food · Shumār')
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveValue('1')
    const units = screen.getByRole('group', { name: 'Unit' })
    expect(
      within(units)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['cup', 'Grams'])
    const meals = screen.getByRole('group', { name: 'Meal' })
    expect(within(meals).getByRole('button', { name: 'Breakfast' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('45')).toBeInTheDocument()
  })

  it('saves a new amount and meal, then goes back to Today', async () => {
    const fake = renderScreen(
      fakeClient({ data: row(), error: null }, { data: row({ quantity: 2, meal: 'lunch' }), error: null }),
    )
    await screen.findByRole('heading', { level: 1, name: 'Test tea' })
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Meal' })).getByRole('button', { name: 'Lunch' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const update = fake.queries[1].find(([name]) => name === 'update')?.[1][0]
    expect(update).toEqual({
      meal: 'lunch',
      quantity: 2,
      unit_name: 'cup',
      grams: 300,
      kcal: 90,
      protein: 3,
      carbs: 9,
      fat: 4.5,
      sodium_mg: 600,
    })
    expect(window.location.pathname).toBe('/')
  })

  it('goes back to Today without saving', async () => {
    const fake = renderScreen(fakeClient({ data: row(), error: null }))
    await screen.findByRole('heading', { level: 1, name: 'Test tea' })
    await userEvent.click(screen.getByRole('button', { name: 'Back to Today' }))
    expect(window.location.pathname).toBe('/')
    expect(fake.queries).toHaveLength(1)
  })

  it('stays open and explains when the change cannot be saved', async () => {
    renderScreen(fakeClient({ data: row(), error: null }, { data: null, error: { message: 'offline' } }))
    await screen.findByRole('heading', { level: 1, name: 'Test tea' })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save your changes.")
    expect(window.location.pathname).toBe('/log/edit/log-1')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it('says so when the food is not there', async () => {
    renderScreen(fakeClient({ data: null, error: null }))
    expect(
      await screen.findByText("We couldn't find this food. It may have been removed."),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Edit food' })).toHaveFocus())
    expect(screen.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '/')
  })

  it('explains when the food cannot be loaded', async () => {
    renderScreen(fakeClient({ data: null, error: { message: 'offline' } }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load this food.")
  })

  it('shows a loading state first', () => {
    renderScreen(fakeClient({ data: row(), error: null }))
    expect(screen.getByRole('heading', { level: 1, name: 'Edit food' })).toBeInTheDocument()
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })
})
