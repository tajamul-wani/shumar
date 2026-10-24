import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AppClient } from '../auth/context.ts'
import { FIRST_RUN_KEY, readAnswers, saveAnswers, type FirstRunAnswers } from '../lib/firstRun.ts'
import { useProfile } from './context.ts'
import { ProfileProvider } from './ProfileProvider.tsx'

// Test answers only, not a real person.
const answers: FirstRunAnswers = {
  ageYears: 30,
  sex: 'female',
  weightKg: 60,
  weightUnit: 'kg',
  heightCm: 160,
  activity: 'moderate',
  goal: { kind: 'maintain' },
}

const savedRow = {
  age_years: 41,
  answered_at: new Date().toISOString(),
  sex: 'male',
  weight_kg: 80,
  weight_unit: 'kg',
  height_cm: 175,
  activity: 'light',
  goal: 'gain',
  loss_kg_per_week: null,
}

type Result = { data: unknown; error: { message: string } | null }

/** Answers each save from `saves` in turn, and each read with `read`. */
function fakeClient({ saves = [], read }: { saves?: Result[]; read?: Result }) {
  const upsert = vi.fn<(row: unknown) => Promise<Result>>(
    async () => saves.shift() ?? { data: null, error: null },
  )
  const maybeSingle = vi.fn<() => Promise<Result>>(async () => read ?? { data: null, error: null })
  const from = vi.fn<(table: string) => unknown>(() => ({ upsert, select: () => ({ maybeSingle }) }))
  return { client: { from } as unknown as AppClient, upsert, maybeSingle }
}

function Show() {
  const { answers: shown, status, error, reload } = useProfile()
  return (
    <div>
      <p>status: {status}</p>
      <p>age: {shown?.ageYears ?? 'none'}</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={reload}>
        Try again
      </button>
    </div>
  )
}

function renderProfile(client: AppClient) {
  render(
    <AuthContext.Provider value={{ client, session: null, loading: false }}>
      <ProfileProvider userId="user-a">
        <Show />
      </ProfileProvider>
    </AuthContext.Provider>,
  )
}

afterEach(() => localStorage.clear())

describe('ProfileProvider', () => {
  it('saves answers given before sign-in, replacing any saved, then clears them from the device', async () => {
    saveAnswers(answers)
    const fake = fakeClient({ read: { data: savedRow, error: null } })
    renderProfile(fake.client)
    expect(screen.getByText('status: loading')).toBeInTheDocument()
    await screen.findByText('status: ready')

    expect(fake.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-a', age_years: 30, sex: 'female', goal: 'maintain' }),
      { onConflict: 'user_id' },
    )
    expect(fake.maybeSingle).not.toHaveBeenCalled()
    expect(screen.getByText('age: 30')).toBeInTheDocument()
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBeNull()
  })

  it('reads the saved answers when the device has none', async () => {
    const fake = fakeClient({ read: { data: savedRow, error: null } })
    renderProfile(fake.client)
    await screen.findByText('age: 41')
    expect(fake.upsert).not.toHaveBeenCalled()
  })

  it('leaves unfinished answers on the device and reads the saved ones', async () => {
    saveAnswers({ ...answers, goal: undefined })
    const fake = fakeClient({ read: { data: null, error: null } })
    renderProfile(fake.client)
    await screen.findByText('status: ready')
    expect(screen.getByText('age: none')).toBeInTheDocument()
    expect(fake.upsert).not.toHaveBeenCalled()
    expect(readAnswers().ageYears).toBe(30)
  })

  it('keeps the answers on the device when saving fails, and tries again', async () => {
    saveAnswers(answers)
    const fake = fakeClient({ saves: [{ data: null, error: { message: 'offline' } }] })
    renderProfile(fake.client)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't save your answers. Check your connection and try again.",
    )
    expect(localStorage.getItem(FIRST_RUN_KEY)).not.toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('status: ready')
    expect(fake.upsert).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBeNull()
  })

  it('explains a failed read', async () => {
    renderProfile(fakeClient({ read: { data: null, error: { message: 'offline' } } }).client)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load your target."))
    expect(screen.getByText('status: error')).toBeInTheDocument()
  })
})
