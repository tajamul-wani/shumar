import type { User } from '@supabase/supabase-js'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Switch } from 'wouter'
import { AuthContext, type AppClient } from '../auth/context.ts'
import { useProfile } from '../profile/context.ts'
import { ProfileProvider } from '../profile/ProfileProvider.tsx'
import { YouScreen } from '../screens/YouScreen.tsx'
import { ThemeProvider } from '../theme/ThemeProvider.tsx'
import { FIRST_RUN_STEP_PATH, TARGET_PATH } from './paths.ts'
import { SetTargetCard } from './SetTargetCard.tsx'
import { SetTargetQuestion, SetTargetReview } from './SetTarget.tsx'

// Test answers only, not a real person: a target of 2,176 kcal, 128 g protein, 280 g carbs, 60 g fat.
const savedRow = {
  age_years: 30,
  answered_at: new Date().toISOString(),
  sex: 'male',
  weight_kg: 80,
  weight_unit: 'kg',
  height_cm: 175,
  activity: 'light',
  goal: 'lose',
  loss_kg_per_week: 0.5,
}

type Result = { data: unknown; error: { message: string } | null }

function fakeClient({
  row = null,
  saves = [],
  loads = [],
}: { row?: unknown; saves?: Result[]; loads?: Result[] } = {}) {
  const upsert = vi.fn<(value: Record<string, unknown>) => Promise<Result>>(
    async () => saves.shift() ?? { data: null, error: null },
  )
  const maybeSingle = vi.fn<() => Promise<Result>>(async () => loads.shift() ?? { data: row, error: null })
  const from = vi.fn<(table: string) => unknown>(() => ({ upsert, select: () => ({ maybeSingle }) }))
  return { client: { auth: {}, from } as unknown as AppClient, upsert }
}

/** Today, reduced to what these tests need: the target, or the way to set one. */
function TodayStub() {
  const { answers, status } = useProfile()
  if (status !== 'ready') return null
  return answers ? <h1>Today with a target</h1> : <SetTargetCard />
}

function renderApp(fake: ReturnType<typeof fakeClient>, path: string) {
  window.history.replaceState(null, '', path)
  const user = {
    id: 'user-a',
    email: 'a@example.com',
    user_metadata: {},
    app_metadata: {},
  } as unknown as User
  render(
    <ThemeProvider>
      <AuthContext.Provider value={{ client: fake.client, session: null, loading: false }}>
        <ProfileProvider userId="user-a">
          <main id="main">
            <Switch>
              <Route path="/">
                <TodayStub />
              </Route>
              <Route path="/you">
                <YouScreen user={user} />
              </Route>
              <Route path={TARGET_PATH}>
                <SetTargetReview />
              </Route>
              <Route path={FIRST_RUN_STEP_PATH}>{(params) => <SetTargetQuestion step={params.step} />}</Route>
            </Switch>
          </main>
        </ProfileProvider>
      </AuthContext.Provider>
    </ThemeProvider>,
  )
}

const user = () => userEvent.setup()

async function continueOn() {
  await user().click(screen.getByRole('button', { name: 'Continue' }))
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
})

describe('setting a target after sign-in', () => {
  it('goes from the card through the questions, saves the target and comes back to Today', async () => {
    const fake = fakeClient()
    renderApp(fake, '/')
    await user().click(await screen.findByRole('link', { name: 'Set my target' }))
    expect(window.location.pathname).toBe('/start/age')
    // Signed in, the app's own frame shows the logo, so the questions leave theirs out.
    expect(screen.queryByRole('img', { name: 'Shumār' })).not.toBeInTheDocument()

    await user().type(screen.getByLabelText('Age'), '30')
    await continueOn()
    await user().click(screen.getByRole('radio', { name: 'Male' }))
    await continueOn()
    await user().type(screen.getByLabelText('Weight'), '80')
    await continueOn()
    await user().type(screen.getByLabelText('Height'), '175')
    await continueOn()
    await user().click(screen.getByRole('radio', { name: /Lightly active/ }))
    await continueOn()
    await user().click(screen.getByRole('radio', { name: /Lose weight/ }))
    await user().click(screen.getByRole('button', { name: 'See my daily target' }))

    expect(screen.getByRole('region', { name: 'Daily target' })).toHaveTextContent('2,176kcal')
    await user().click(screen.getByRole('button', { name: 'Save my target' }))
    expect(fake.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-a',
        age_years: 30,
        weight_kg: 80,
        goal: 'lose',
        loss_kg_per_week: 0.5,
      }),
      { onConflict: 'user_id' },
    )
    expect(window.location.pathname).toBe('/')
    expect(await screen.findByRole('heading', { name: 'Today with a target' })).toBeInTheDocument()
    // The device keeps nothing: these answers never went through it.
    expect(localStorage.length).toBe(0)
  })

  it('waits for the saved answers when a question is reloaded, then shows it filled in', async () => {
    renderApp(fakeClient({ row: savedRow }), '/start/weight')
    expect(await screen.findByLabelText('Weight')).toHaveValue('80')
    expect(window.location.pathname).toBe('/start/weight')
  })

  it('explains a failed save and keeps the person on the target', async () => {
    const fake = fakeClient({ row: savedRow, saves: [{ data: null, error: { message: 'offline' } }] })
    renderApp(fake, '/start/target')
    await user().click(await screen.findByRole('button', { name: 'Save my target' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save your answers.")
    expect(screen.getByRole('button', { name: 'Save my target' })).toBeEnabled()
    expect(window.location.pathname).toBe('/start/target')
  })
})

/** The cards on the screen, in order, by name. */
function cardNames() {
  return screen
    .getAllByRole('region')
    .map(
      (region) =>
        region.getAttribute('aria-label') ??
        document.getElementById(region.getAttribute('aria-labelledby') ?? '')?.textContent,
    )
}

describe('the You screen', () => {
  it("shows the daily target and the details it comes from, in the design's order", async () => {
    renderApp(fakeClient({ row: savedRow }), '/you')
    const target = await screen.findByRole('region', { name: 'Daily target' })
    expect(target).toHaveTextContent('2,176kcal')
    expect(target).toHaveTextContent(
      'Set from your details to lose about 0.5 kg a week, using the Mifflin-St Jeor formula. You can change it any time.',
    )
    expect(target).toHaveTextContent('Protein128 g')
    // On phones the button says "Adjust", with the full name for screen readers.
    expect(within(target).getByRole('link', { name: 'Adjust target' })).toHaveTextContent(/^Adjust$/)
    const details = screen.getByRole('region', { name: 'Your details' })
    expect(
      within(details)
        .getAllByRole('link')
        .map((row) => row.textContent),
    ).toEqual([
      'Height 175 cm',
      'Weight 80 kg',
      'Age 30 years',
      'Sex Male',
      'Activity Lightly active',
      'Goal Lose 0.5 kg a week',
      'Units kg, cm',
    ])
  })

  it('reopens the questions with the saved answers to adjust the target, and saves the change', async () => {
    const fake = fakeClient({ row: savedRow })
    renderApp(fake, '/you')
    await user().click(await screen.findByRole('link', { name: 'Adjust target' }))
    expect(screen.getByLabelText('Age')).toHaveValue('30')
    await continueOn()
    expect(screen.getByRole('radio', { name: 'Male' })).toBeChecked()
    await continueOn()
    const weight = screen.getByLabelText('Weight')
    await user().clear(weight)
    await user().type(weight, '78')
    await continueOn()
    await continueOn()
    await continueOn()
    await user().click(screen.getByRole('button', { name: 'See my daily target' }))
    await user().click(screen.getByRole('button', { name: 'Save my target' }))
    expect(fake.upsert).toHaveBeenCalledWith(expect.objectContaining({ weight_kg: 78, age_years: 30 }), {
      onConflict: 'user_id',
    })
  })

  it.each([
    ['Height 175 cm', '/start/height', 'Height', '175'],
    ['Units kg, cm', '/start/weight', 'Weight', '80'],
  ])('opens the question behind %s, filled in', async (row, path, field, value) => {
    renderApp(fakeClient({ row: savedRow }), '/you')
    await user().click(await screen.findByRole('link', { name: row }))
    expect(window.location.pathname).toBe(path)
    expect(screen.getByLabelText(field)).toHaveValue(value)
  })

  it('says when the safety floor slows the loss', async () => {
    const row = {
      ...savedRow,
      sex: 'female',
      weight_kg: 60,
      height_cm: 160,
      activity: 'sedentary',
      loss_kg_per_week: 0.75,
    }
    renderApp(fakeClient({ row }), '/you')
    const target = await screen.findByRole('region', { name: 'Daily target' })
    expect(target).toHaveTextContent('1,200kcal')
    expect(target).toHaveTextContent("won't go below 1,200 kcal a day")
  })

  it('offers to set a target in the target card when there is none', async () => {
    renderApp(fakeClient(), '/you')
    const card = await screen.findByRole('region', { name: 'Daily target' })
    expect(within(card).getByRole('link', { name: 'Set my target' })).toHaveAttribute('href', '/start/age')
    expect(screen.queryByRole('region', { name: 'Your details' })).not.toBeInTheDocument()
  })

  it('explains in the target card when the target cannot load, and tries again on request', async () => {
    const offline = { data: null, error: { message: 'offline' } }
    renderApp(fakeClient({ row: savedRow, loads: [offline] }), '/you')
    const card = await screen.findByRole('region', { name: 'Daily target' })
    expect(await within(card).findByRole('alert')).toHaveTextContent("We couldn't load your target.")
    await user().click(within(card).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('region', { name: 'Your details' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Daily target' })).toHaveTextContent('2,176kcal')
  })

  it('puts Appearance between the target and the details on phones, as designed', async () => {
    renderApp(fakeClient({ row: savedRow }), '/you')
    await screen.findByRole('region', { name: 'Your details' })
    expect(cardNames()).toEqual(['Account', 'Daily target', 'Appearance', 'Your details', 'About'])
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
    })

    it('keeps the target and details in the first column and the settings in the second', async () => {
      renderApp(fakeClient({ row: savedRow }), '/you')
      await screen.findByRole('region', { name: 'Your details' })
      expect(cardNames()).toEqual(['Account', 'Daily target', 'Your details', 'Appearance', 'About'])
      expect(screen.getByRole('link', { name: 'Adjust target' })).toHaveTextContent(/^Adjust target$/)
    })
  })
})
