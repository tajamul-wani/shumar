import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AppClient } from '../auth/context.ts'
import { TodayScreen } from './TodayScreen.tsx'

// Made-up logs with easy numbers for checking the screen, not nutrition data.
function log(id: string, meal: string, name: string, time: string, kcal: number, sodiumMg = 0) {
  return {
    id,
    log_date: '2026-10-21',
    logged_at: `2026-10-21T${time}:00+05:30`,
    meal,
    food_name: name,
    food_source: 'usda',
    food_source_id: id,
    quantity: 1,
    unit_name: 'g',
    grams: 100,
    kcal,
    protein: 1,
    carbs: 2,
    fat: 3,
    sodium_mg: sodiumMg,
  }
}

const day = [
  log('1', 'breakfast', 'Test tea', '08:10', 45, 600),
  log('2', 'breakfast', 'Test bread', '08:05', 240, 300),
  log('3', 'dinner', 'Test rice', '20:45', 200),
  log('4', 'breakfast', 'Test tea', '09:00', 45, 600),
]

type Result = { data: unknown; error: { message: string } | null }

interface FakeOptions {
  logs?: unknown[]
  daysLogged?: Result
  failLogs?: boolean
  failRemove?: boolean
  failRestore?: boolean
}

/** Answers the day's logs and the days-logged count, and records what was asked. */
function fakeClient(options: FakeOptions = {}) {
  const state = { logs: options.logs ?? day, failLogs: options.failLogs ?? false }
  const eq = vi.fn<(column: string, value: unknown) => void>()
  const removed = vi.fn<(id: unknown) => void>()
  const inserted = vi.fn<(row: unknown) => void>()
  const offline = { data: null, error: { message: 'offline' } }
  const from = vi.fn<(table: string) => unknown>(() => {
    let kind: 'read' | 'remove' | 'restore' = 'read'
    let row: Record<string, unknown> = {}
    const answer = (): Result => {
      if (kind === 'remove') return options.failRemove ? offline : { data: [{ id: 'x' }], error: null }
      if (kind === 'restore')
        return options.failRestore ? offline : { data: { ...row, id: 'restored' }, error: null }
      return state.failLogs ? offline : { data: state.logs, error: null }
    }
    const query: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(answer()).then(resolve, reject),
    }
    for (const name of ['select', 'order', 'single']) query[name] = () => query
    query.eq = (column: string, value: unknown) => {
      eq(column, value)
      if (kind === 'remove') removed(value)
      return query
    }
    query.delete = () => {
      kind = 'remove'
      return query
    }
    query.insert = (value: Record<string, unknown>) => {
      kind = 'restore'
      row = value
      inserted(value)
      return query
    }
    return query
  })
  const rpc = vi.fn<(name: string) => Promise<Result>>(
    async () => options.daysLogged ?? { data: 12, error: null },
  )
  return { client: { auth: {}, from, rpc } as unknown as AppClient, state, from, rpc, eq, removed, inserted }
}

function renderToday(fake = fakeClient()) {
  render(
    <AuthContext.Provider value={{ client: fake.client, session: null, loading: false }}>
      <main id="main">
        <TodayScreen />
      </main>
    </AuthContext.Provider>,
  )
  return fake
}

const ring = () => screen.getByRole('region', { name: 'Calories and macros' })

beforeEach(() => {
  // 8 pm on 21 October 2026. Only the clock is faked; timers stay real.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 21, 20, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the day at a glance', () => {
  it("reads only today's logs and shows a loading state first", async () => {
    const { eq } = renderToday()
    expect(screen.getByText('Loading your day')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Calories and macros' })).toBeInTheDocument()
    expect(eq).toHaveBeenCalledWith('log_date', '2026-10-21')
    expect(screen.queryByText('Loading your day')).not.toBeInTheDocument()
  })

  it('shows the calories eaten in the ring, then protein, carbs and fat in that order', async () => {
    renderToday()
    await screen.findByRole('region', { name: 'Calories and macros' })
    expect(within(ring()).getByText('530')).toBeInTheDocument()
    expect(within(ring()).getByText('kcal eaten')).toBeInTheDocument()
    const macros = within(ring())
      .getAllByText(/^(Protein|Carbs|Fat)$/)
      .map((label) => `${label.textContent} ${label.nextElementSibling?.textContent}`)
    expect(macros).toEqual(['Protein 4 g', 'Carbs 8 g', 'Fat 12 g'])
  })

  it('lists the meals with food in them, in the order of the day, with their calories', async () => {
    renderToday()
    const meals = await screen.findByRole('region', { name: 'Meals' })
    expect(
      within(meals)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['BreakfastTest bread · Test tea330 kcal', 'DinnerTest rice200 kcal'])
  })

  it('shows how many days have been logged', async () => {
    renderToday()
    expect(await screen.findByText('12 days logged')).toBeInTheDocument()
  })

  it('says "1 day" for one day', async () => {
    renderToday(fakeClient({ daysLogged: { data: 1, error: null } }))
    expect(await screen.findByText('1 day logged')).toBeInTheDocument()
  })

  it.each([
    ['no days', { data: 0, error: null }],
    ['an error', { data: null, error: { message: 'offline' } }],
  ])('hides the count for %s', async (_, daysLogged) => {
    const fake = renderToday(fakeClient({ daysLogged }))
    await screen.findByRole('region', { name: 'Calories and macros' })
    await fake.rpc.mock.results[0].value
    expect(screen.queryByText(/logged$/)).not.toBeInTheDocument()
  })
})

describe('the sodium alert', () => {
  it('stays away while the day is under 2,000 mg', async () => {
    renderToday()
    await screen.findByRole('region', { name: 'Calories and macros' })
    expect(screen.queryByRole('region', { name: 'Evening review' })).not.toBeInTheDocument()
  })

  it('names the food that gave the most once the day passes 2,000 mg', async () => {
    renderToday(fakeClient({ logs: [...day, log('5', 'lunch', 'Test pickle', '13:00', 10, 1000)] }))
    const review = await screen.findByRole('region', { name: 'Evening review' })
    expect(review).toHaveTextContent('Sodium is high, mostly from Test tea')
    expect(review).toHaveTextContent('2,500 mg')
    // The warning icon goes with the text and is hidden from screen readers.
    expect(review.querySelector('svg.text-alert-surplus')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('an empty or failed day', () => {
  it('shows nothing eaten and how to add the first food', async () => {
    renderToday(fakeClient({ logs: [], daysLogged: { data: 0, error: null } }))
    const meals = await screen.findByRole('region', { name: 'Meals' })
    expect(within(ring()).getByText('0')).toBeInTheDocument()
    expect(meals).toHaveTextContent('No meals yet today.')
    expect(within(meals).getByRole('link', { name: 'Add food' })).toHaveAttribute('href', '/log')
  })

  it('explains a failed load and tries again on request', async () => {
    const fake = renderToday(fakeClient({ failLogs: true }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your food for today.")
    fake.state.failLogs = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('region', { name: 'Meals' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('changing and removing foods', () => {
  async function openBreakfast() {
    const meals = await screen.findByRole('region', { name: 'Meals' })
    const row = within(meals).getByRole('button', { name: /^Breakfast/ })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    return meals
  }

  it('opens a meal to list its foods, each with a way to change it', async () => {
    renderToday()
    const meals = await openBreakfast()
    expect(within(meals).getByText('Test bread')).toBeInTheDocument()
    expect(within(meals).getAllByRole('link', { name: 'Change Test tea' })[0]).toHaveAttribute(
      'href',
      '/log/edit/1',
    )
    expect(within(meals).getByRole('link', { name: 'Change Test bread' })).toHaveAttribute(
      'href',
      '/log/edit/2',
    )
    expect(within(meals).queryByRole('button', { name: 'Remove Test rice' })).not.toBeInTheDocument()
  })

  it('removes a food at once and puts it back exactly as it was with Undo', async () => {
    const fake = renderToday()
    const meals = await openBreakfast()
    await userEvent.click(within(meals).getByRole('button', { name: 'Remove Test bread' }))

    expect(fake.removed).toHaveBeenCalledWith('2')
    expect(within(meals).queryByText('Test bread')).not.toBeInTheDocument()
    expect(within(ring()).getByText('290')).toBeInTheDocument()
    expect(screen.getByText('Removed Test bread from breakfast.')).toBeInTheDocument()
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toHaveFocus()

    await userEvent.click(undo)
    expect(fake.inserted).toHaveBeenCalledWith(
      expect.objectContaining({
        food_name: 'Test bread',
        meal: 'breakfast',
        kcal: 240,
        logged_at: '2026-10-21T08:05:00+05:30',
      }),
    )
    expect(await within(meals).findByText('Test bread')).toBeInTheDocument()
    expect(within(ring()).getByText('530')).toBeInTheDocument()
    expect(screen.getByText('Put Test bread back in breakfast.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('brings the food back and explains when it cannot be removed', async () => {
    renderToday(fakeClient({ failRemove: true }))
    const meals = await openBreakfast()
    await userEvent.click(within(meals).getByRole('button', { name: 'Remove Test bread' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't remove this food.")
    expect(within(meals).getByText('Test bread')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('keeps Undo and explains when the food cannot be put back', async () => {
    renderToday(fakeClient({ failRestore: true }))
    const meals = await openBreakfast()
    await userEvent.click(within(meals).getByRole('button', { name: 'Remove Test bread' }))
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't put this food back.")
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
  })

  it("shows the empty day after removing the day's only food", async () => {
    renderToday(fakeClient({ logs: [log('3', 'dinner', 'Test rice', '20:45', 200)] }))
    const meals = await screen.findByRole('region', { name: 'Meals' })
    await userEvent.click(within(meals).getByRole('button', { name: /^Dinner/ }))
    await userEvent.click(within(meals).getByRole('button', { name: 'Remove Test rice' }))
    expect(screen.getByText('No meals yet today.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
  })
})
