import { describe, expect, it, vi } from 'vitest'
import { KG_PER_LB, type FirstRunAnswers } from './firstRun.ts'
import { ProfileError, currentAge, fetchProfile, parseProfileRow, saveProfile } from './profile.ts'

// Test answers only, not a real person.
const answers: FirstRunAnswers = {
  ageYears: 30,
  sex: 'male',
  weightKg: 176 * KG_PER_LB,
  weightUnit: 'lb',
  heightCm: 175.25,
  activity: 'light',
  goal: { kind: 'lose', kgPerWeek: 0.5 },
}

const now = new Date('2026-10-23T12:00:00Z')

function row(overrides: Record<string, unknown> = {}) {
  return {
    age_years: 30,
    answered_at: '2026-10-23T09:00:00+00:00',
    sex: 'male',
    weight_kg: 79.832,
    weight_unit: 'lb',
    height_cm: 175.3,
    activity: 'light',
    goal: 'lose',
    loss_kg_per_week: 0.5,
    ...overrides,
  }
}

type Result = { data: unknown; error: { message: string } | null }

/** A stand-in for the Supabase query builder: records each call and answers with one result. */
function fakeClient(result: Result) {
  const calls: [string, unknown[]][] = []
  const query: Record<string, unknown> = {
    then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  for (const name of ['select', 'maybeSingle', 'upsert']) {
    query[name] = (...args: unknown[]) => {
      calls.push([name, args])
      return query
    }
  }
  const from = vi.fn<(table: string) => unknown>(() => query)
  return { client: { from } as unknown as Parameters<typeof fetchProfile>[0], calls, from }
}

const call = (calls: [string, unknown[]][], name: string) => calls.find(([n]) => n === name)?.[1]

describe('currentAge', () => {
  it('adds the whole years since the age was given', () => {
    const given = new Date('2025-10-01T00:00:00Z')
    expect(currentAge(30, given, new Date('2026-09-30T00:00:00Z'))).toBe(30)
    expect(currentAge(30, given, new Date('2026-10-02T00:00:00Z'))).toBe(31)
    expect(currentAge(30, given, new Date('2028-10-02T00:00:00Z'))).toBe(33)
  })

  it('never goes down when a clock is behind', () => {
    expect(currentAge(30, new Date('2027-01-01T00:00:00Z'), now)).toBe(30)
  })
})

describe('parseProfileRow', () => {
  it('turns a row into answers, accepting numbers sent as text', () => {
    expect(parseProfileRow(row({ weight_kg: '79.832', loss_kg_per_week: '0.50' }), now)).toEqual({
      ageYears: 30,
      sex: 'male',
      weightKg: 79.832,
      weightUnit: 'lb',
      heightCm: 175.3,
      activity: 'light',
      goal: { kind: 'lose', kgPerWeek: 0.5 },
    })
  })

  it('reads a goal without a speed', () => {
    expect(parseProfileRow(row({ goal: 'recomp', loss_kg_per_week: null }), now)?.goal).toEqual({
      kind: 'recomp',
    })
  })

  it('counts the years since the age was given', () => {
    expect(parseProfileRow(row({ answered_at: '2024-01-01T00:00:00Z' }), now)?.ageYears).toBe(32)
  })

  it.each([
    [{ sex: 'other' }],
    [{ weight_kg: 400 }],
    [{ goal: 'lose', loss_kg_per_week: null }],
    [{ answered_at: 'yesterday' }],
    [{ age_years: 99, answered_at: '2020-01-01T00:00:00Z' }],
  ])('refuses a row with %o', (overrides) => {
    expect(parseProfileRow(row(overrides), now)).toBeNull()
  })

  it('refuses nothing at all', () => {
    expect(parseProfileRow(null, now)).toBeNull()
  })
})

describe('fetchProfile', () => {
  it('reads only the answer columns, from the profiles table', async () => {
    const fake = fakeClient({ data: row(), error: null })
    expect(await fetchProfile(fake.client, now)).toEqual(parseProfileRow(row(), now))
    expect(fake.from).toHaveBeenCalledWith('profiles')
    expect(call(fake.calls, 'select')?.[0]).toBe(
      'age_years, answered_at, sex, weight_kg, weight_unit, height_cm, activity, goal, loss_kg_per_week',
    )
    expect(call(fake.calls, 'maybeSingle')).toEqual([])
  })

  it('gives null for someone who has not answered yet', async () => {
    expect(await fetchProfile(fakeClient({ data: null, error: null }).client, now)).toBeNull()
  })

  it('explains a failed read', async () => {
    const failing = fakeClient({ data: null, error: { message: 'offline' } }).client
    await expect(fetchProfile(failing, now)).rejects.toThrow(
      new ProfileError("We couldn't load your target. Check your connection and try again."),
    )
  })
})

describe('saveProfile', () => {
  it('saves the answers as one row per person, rounded to what the table keeps', async () => {
    const fake = fakeClient({ data: null, error: null })
    await saveProfile(fake.client, 'user-a', answers, now)
    expect(fake.from).toHaveBeenCalledWith('profiles')
    expect(call(fake.calls, 'upsert')).toEqual([
      {
        user_id: 'user-a',
        age_years: 30,
        answered_at: '2026-10-23T12:00:00.000Z',
        sex: 'male',
        weight_kg: 79.832,
        weight_unit: 'lb',
        height_cm: 175.3,
        activity: 'light',
        goal: 'lose',
        loss_kg_per_week: 0.5,
      },
      { onConflict: 'user_id' },
    ])
  })

  it('sends no speed for a goal other than losing weight', async () => {
    const fake = fakeClient({ data: null, error: null })
    await saveProfile(fake.client, 'user-a', { ...answers, goal: { kind: 'gain' } }, now)
    expect(call(fake.calls, 'upsert')?.[0]).toMatchObject({ goal: 'gain', loss_kg_per_week: null })
  })

  it('needs every answer', async () => {
    const fake = fakeClient({ data: null, error: null })
    await expect(
      saveProfile(fake.client, 'user-a', { ...answers, activity: undefined }, now),
    ).rejects.toThrow(new ProfileError('Answer every question to set your target.'))
    expect(fake.from).not.toHaveBeenCalled()
  })

  it('explains a failed save', async () => {
    const failing = fakeClient({ data: null, error: { message: 'offline' } }).client
    await expect(saveProfile(failing, 'user-a', answers, now)).rejects.toThrow(
      new ProfileError("We couldn't save your answers. Check your connection and try again."),
    )
  })
})
