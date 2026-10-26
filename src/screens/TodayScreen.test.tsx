import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AppClient } from '../auth/context.ts'
import { NO_ANSWERS, type FirstRunAnswers } from '../lib/firstRun.ts'
import { ProfileContext, type ProfileState } from '../profile/context.ts'
import { TodayScreen } from './TodayScreen.tsx'

/** A time on 21 October 2026 on this machine's clock, so the tests pass in any time zone. */
function at(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(2026, 9, 21, hours, minutes).toISOString()
}

// Made-up logs with easy numbers for checking the screen, not nutrition data.
function log(id: string, meal: string, name: string, time: string, kcal: number, sodiumMg = 0) {
  return {
    id,
    log_date: '2026-10-21',
    logged_at: at(time),
    meal,
    food_name: name,
    food_source: 'usda',
    // The same food always has the same source id, as in real data.
    food_source_id: name,
    quantity: 100,
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

function renderToday(fake = fakeClient(), profile: Partial<ProfileState> = {}) {
  const value: ProfileState = {
    answers: null,
    status: 'ready',
    error: null,
    reload: vi.fn<() => void>(),
    editing: null,
    edit: vi.fn<(answers: FirstRunAnswers | null) => void>(),
    save: vi.fn<(answers: FirstRunAnswers) => Promise<void>>(),
    ...profile,
  }
  render(
    <AuthContext.Provider value={{ client: fake.client, session: null, loading: false }}>
      <ProfileContext.Provider value={value}>
        <main id="main">
          <TodayScreen />
        </main>
      </ProfileContext.Provider>
    </AuthContext.Provider>,
  )
  return { ...fake, profile: value }
}

// Test answers only, not a real person: a target of 2,176 kcal, 128 g protein, 280 g carbs, 60 g fat.
const answers: FirstRunAnswers = {
  ageYears: 30,
  sex: 'male',
  weightKg: 80,
  weightUnit: 'kg',
  heightCm: 175,
  activity: 'light',
  goal: { kind: 'lose', kgPerWeek: 0.5 },
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

  it('lists the meals with food in them, in the order of the day, with their calories and macros', async () => {
    renderToday()
    const meals = await screen.findByRole('region', { name: 'Meals' })
    const cards = within(meals).getAllByRole('article')
    expect(cards.map((card) => within(card).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Breakfast',
      'Dinner',
    ])
    expect(cards[0]).toHaveTextContent('330 kcal62% of today')
    expect(cards[0]).toHaveTextContent('Protein 3 g Carbs 6 g Fat 9 g')
    expect(cards[1]).toHaveTextContent('200 kcal38% of today')
    expect(cards[1]).toHaveTextContent('Protein 1 g Carbs 2 g Fat 3 g')
    // Every food is listed without a tap, and the biggest meal is marked.
    expect(cards[0]).toHaveTextContent('Test tea')
    expect(cards[0]).toHaveTextContent('Biggest meal')
    expect(cards[1]).not.toHaveTextContent('Biggest meal')
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

describe('with a daily target', () => {
  it('shows the calories left, and each macro against its target', async () => {
    renderToday(fakeClient(), { answers })
    await screen.findByRole('region', { name: 'Calories and macros' })
    expect(within(ring()).getByText('1,646')).toBeInTheDocument()
    expect(within(ring()).getByText('kcal left')).toBeInTheDocument()
    expect(ring()).toHaveTextContent('530 eaten of 2,176 kcal')
    expect(ring()).toHaveTextContent('Protein4128 g')
    expect(ring()).toHaveTextContent('Carbs8280 g')
    expect(ring()).toHaveTextContent('Fat1260 g')
  })

  it('reviews the day: calories left and the macro furthest behind', async () => {
    renderToday(fakeClient(), { answers })
    const review = await screen.findByRole('region', { name: 'Evening review' })
    expect(review).toHaveTextContent('A steady day. You have 1,646 kcal left.')
    expect(review).toHaveTextContent('Carbs are furthest behind, 8 of 280 g.')
    expect(review).not.toHaveTextContent('Sodium is high')
    expect(ring()).toHaveTextContent('Sodium so far 1,500 mg of 2,000')
  })

  it('says when the day went over, and turns the ring red', async () => {
    renderToday(fakeClient({ logs: [log('1', 'lunch', 'Test feast', '13:00', 2500)] }), { answers })
    const review = await screen.findByRole('region', { name: 'Evening review' })
    expect(review).toHaveTextContent('You went 324 kcal over today. One day does not undo a good week.')
    expect(within(ring()).getByText('kcal over')).toBeInTheDocument()
    expect(ring().querySelector('circle.stroke-alert-surplus')).not.toBeNull()
  })

  it('shows the sodium line too when the day is high in sodium', async () => {
    renderToday(fakeClient({ logs: [log('1', 'lunch', 'Test soup', '13:00', 300, 2400)] }), { answers })
    const review = await screen.findByRole('region', { name: 'Evening review' })
    expect(review).toHaveTextContent('A steady day. You have 1,876 kcal left.')
    expect(review).toHaveTextContent('Sodium is high, mostly from Test soup')
  })

  it('waits for something to be eaten before reviewing', async () => {
    renderToday(fakeClient({ logs: [] }), { answers })
    await screen.findByRole('region', { name: 'Calories and macros' })
    expect(within(ring()).getByText('2,176')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Evening review' })).not.toBeInTheDocument()
  })

  it('explains when the target cannot load, and tries again on request', async () => {
    const { profile } = renderToday(fakeClient(), {
      status: 'error',
      error: "We couldn't load your target. Check your connection and try again.",
    })
    await screen.findByRole('region', { name: 'Calories and macros' })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load your target.")
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(profile.reload).toHaveBeenCalled()
    // The day itself still shows, without the target.
    expect(within(ring()).getByText('kcal eaten')).toBeInTheDocument()
  })
  it('offers to set a target when there is none, starting from empty answers', async () => {
    const { profile } = renderToday()
    const card = await screen.findByRole('region', { name: 'Set your daily target' })
    const link = within(card).getByRole('link', { name: 'Set my target' })
    expect(link).toHaveAttribute('href', '/start/age')
    await userEvent.click(link)
    expect(profile.edit).toHaveBeenCalledWith(NO_ANSWERS)
    window.history.replaceState(null, '', '/')
  })

  it.each([
    ['there is a target', { answers }],
    ['the target is still loading', { status: 'loading' as const }],
    ['the target failed to load', { status: 'error' as const, error: 'offline' }],
  ])('offers no target card when %s', async (_, profile) => {
    renderToday(fakeClient(), profile)
    await screen.findByRole('region', { name: 'Calories and macros' })
    expect(screen.queryByRole('region', { name: 'Set your daily target' })).not.toBeInTheDocument()
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
    // The button in the empty state and the round plus both open the popup.
    await userEvent.click(within(meals).getByRole('button', { name: 'Add food' }))
    expect(screen.getByRole('dialog', { name: 'Add food' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search foods' })).toHaveFocus()
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
    // The foods are listed as soon as the day loads: nothing to open.
    return await screen.findByRole('region', { name: 'Meals' })
  }

  it('lists each food with a way to change it', async () => {
    renderToday()
    const meals = await openBreakfast()
    expect(within(meals).getByText('Test bread')).toBeInTheDocument()
    // The two identical teas show as one row, and Edit opens the later one.
    expect(within(meals).getByRole('link', { name: 'Edit one Test tea' })).toHaveAttribute(
      'href',
      '/log/edit/4',
    )
    expect(within(meals).getByRole('link', { name: 'Edit Test bread' })).toHaveAttribute(
      'href',
      '/log/edit/2',
    )
    // Every meal's foods are listed, so dinner's rice can be removed too.
    expect(within(meals).getByRole('button', { name: 'Remove Test rice' })).toBeInTheDocument()
  })

  it('shows the same food in the same amount once, with its count and their calories together', async () => {
    renderToday()
    const meals = await openBreakfast()
    const tea = within(meals).getByText('Test tea').closest('li')
    expect(tea).toHaveTextContent('×2')
    expect(tea).toHaveTextContent('100 g each 90 kcal')
    await userEvent.click(within(meals).getByRole('button', { name: 'Remove one Test tea' }))
    expect(screen.getByText('Removed')).toBeInTheDocument()
    const single = within(meals).getByText('Test tea').closest('li')
    expect(single).toHaveTextContent('100 g 45 kcal')
    expect(single).not.toHaveTextContent('×')
    expect(within(meals).getByRole('button', { name: 'Remove Test tea' })).toBeInTheDocument()
  })

  it('removes a food at once and puts it back exactly as it was with Undo', async () => {
    const fake = renderToday()
    const meals = await openBreakfast()
    await userEvent.click(within(meals).getByRole('button', { name: 'Remove Test bread' }))

    expect(fake.removed).toHaveBeenCalledWith('2')
    expect(within(meals).queryByText('Test bread')).not.toBeInTheDocument()
    expect(within(ring()).getByText('290')).toBeInTheDocument()
    expect(screen.getByText('Removed')).toBeInTheDocument()
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toHaveFocus()

    await userEvent.click(undo)
    expect(fake.inserted).toHaveBeenCalledWith(
      expect.objectContaining({
        food_name: 'Test bread',
        meal: 'breakfast',
        kcal: 240,
        logged_at: at('08:05'),
      }),
    )
    expect(await within(meals).findByText('Test bread')).toBeInTheDocument()
    expect(within(ring()).getByText('530')).toBeInTheDocument()
    expect(screen.getByText('Put back')).toBeInTheDocument()
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
    await userEvent.click(within(meals).getByRole('button', { name: 'Remove Test rice' }))
    expect(screen.getByText('No meals yet today.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
  })
})

describe('on wide screens', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(min-width: 1024px)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('shows the time of each meal and opens the popup from the header, on the meal for the time of day', async () => {
    renderToday()
    const meals = await screen.findByRole('region', { name: 'Meals' })
    expect(within(meals).getByRole('article', { name: 'Breakfast' })).toHaveTextContent('Breakfast8:05')
    expect(within(meals).getByRole('article', { name: 'Dinner' })).toHaveTextContent('Dinner20:45')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Add food' })[0])
    const popup = screen.getByRole('dialog', { name: 'Add food' })
    // 8 pm, so dinner is pressed and the step names it.
    expect(within(popup).getByRole('button', { name: 'Dinner' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(popup).getByText('2. What you ate, for dinner')).toBeInTheDocument()
  })

  it('opens the popup on a meal from its card, lists what is in it, and closes with Done', async () => {
    renderToday()
    const meals = await screen.findByRole('region', { name: 'Meals' })
    await userEvent.click(within(meals).getByRole('button', { name: 'Add to breakfast' }))
    const popup = screen.getByRole('dialog', { name: 'Add food' })
    expect(within(popup).getByRole('button', { name: 'Breakfast' })).toHaveAttribute('aria-pressed', 'true')
    const inMeal = within(popup).getByRole('region', { name: /^In breakfast now/ })
    expect(inMeal).toHaveTextContent('330 kcal')
    expect(within(inMeal).getAllByRole('listitem')).toHaveLength(2)
    expect(inMeal).toHaveTextContent('Test tea ×2')
    await userEvent.click(within(popup).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('takes a meal name of your own, tidied, and refuses an empty one', async () => {
    renderToday()
    await screen.findByRole('region', { name: 'Meals' })
    await userEvent.click(screen.getAllByRole('button', { name: 'Add food' })[0])
    const popup = screen.getByRole('dialog', { name: 'Add food' })
    const name = within(popup).getByRole('textbox', { name: 'Or name a meal' })
    await userEvent.type(name, '  Pre   workout {Enter}')
    expect(within(popup).getByRole('button', { name: 'Pre workout' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(popup).getByText('2. What you ate, for pre workout')).toBeInTheDocument()
    await userEvent.type(name, '   {Enter}')
    expect(within(popup).getByRole('alert')).toHaveTextContent('Give the meal a name')
  })

  it('shows a food added from the popup in the day straight away', async () => {
    // A made-up food the search answers with.
    const egg = {
      source: 'usda',
      source_id: '9',
      name: 'Test egg',
      kcal_per_100g: 150,
      protein_per_100g: 12,
      carbs_per_100g: 1,
      fat_per_100g: 10,
      sodium_mg_per_100g: 140,
      flagged: false,
      verified: true,
      units: [{ name: '1 egg', grams: 50 }],
    }
    const fake = renderToday()
    // The search chains abortSignal() on the request, as the real client allows.
    fake.rpc.mockImplementation((name: string) => {
      const response = Promise.resolve(
        name === 'search_foods' ? { data: [egg], error: null } : { data: 12, error: null },
      )
      return Object.assign(response, { abortSignal: () => response })
    })
    await screen.findByRole('region', { name: 'Meals' })
    fake.state.logs = [...day, log('9', 'dinner', 'Test egg', '20:50', 75)]
    await userEvent.click(screen.getAllByRole('button', { name: 'Add food' })[0])
    // The popup has no recent list: the food is found by searching. The plus on its row opens it,
    // and nothing is added until "Add to dinner".
    const popup = screen.getByRole('dialog', { name: 'Add food' })
    expect(within(popup).queryByRole('region', { name: 'Recent' })).not.toBeInTheDocument()
    await userEvent.type(within(popup).getByRole('searchbox', { name: 'Search foods' }), 'egg')
    await userEvent.click(await within(popup).findByRole('button', { name: 'Add Test egg' }))
    expect(fake.inserted).not.toHaveBeenCalled()
    expect(within(popup).getByRole('heading', { level: 2, name: 'Test egg' })).toHaveFocus()
    await userEvent.click(within(popup).getByRole('button', { name: 'Add to dinner' }))
    expect(fake.inserted).toHaveBeenCalledWith(
      expect.objectContaining({ food_name: 'Test egg', meal: 'dinner' }),
    )
    expect(await within(ring()).findByText('605')).toBeInTheDocument()
    expect(within(popup).getByRole('region', { name: /^In dinner now/ })).toHaveTextContent('Test egg')
  })
})

describe('on phones and tablets', () => {
  it('opens the popup from the round plus', async () => {
    renderToday()
    await screen.findByRole('region', { name: 'Meals' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Add food' }).at(-1)!)
    expect(screen.getByRole('dialog', { name: 'Add food' })).toBeInTheDocument()
  })
})
