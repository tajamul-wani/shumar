import { describe, expect, it } from 'vitest'
import { clearUserData } from './auth.ts'
import {
  FIRST_RUN_KEY,
  KG_PER_LB,
  LOSS_RATES,
  NO_ANSWERS,
  WEIGHT_LIMITS_LB,
  checkAge,
  checkHeight,
  checkWeight,
  clearAnswers,
  firstUnanswered,
  goalSummary,
  parseAnswers,
  readAnswers,
  saveAnswers,
  speedLabel,
  toProfile,
  weightHint,
  weightInUnit,
  type FirstRunAnswers,
} from './firstRun.ts'
import { dailyTargets } from './targets.ts'

// Test answers only, not a real person.
const complete: FirstRunAnswers = {
  ageYears: 30,
  sex: 'male',
  weightKg: 80,
  weightUnit: 'kg',
  heightCm: 175,
  activity: 'light',
  goal: { kind: 'lose', kgPerWeek: 0.5 },
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

const throwing = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

describe('checking typed answers', () => {
  it.each([
    ['30', 30],
    [' 18 ', 18],
    ['100', 100],
  ])('accepts an age of %j', (text, value) => {
    expect(checkAge(text)).toEqual({ ok: true, value })
  })

  it.each(['', '17', '101', '30.5', 'thirty', '-20', '3e1'])('rejects an age of %j', (text) => {
    expect(checkAge(text)).toEqual({ ok: false, message: 'Enter your age in whole years, from 18 to 100.' })
  })

  it.each([
    ['80', 80],
    ['72.5', 72.5],
    ['30', 30],
    ['300', 300],
  ])('accepts %j kg', (text, value) => {
    expect(checkWeight(text, 'kg')).toEqual({ ok: true, value })
  })

  it.each(['', '29.9', '300.1', '80kg', '1,5'])('rejects %j kg', (text) => {
    expect(checkWeight(text, 'kg')).toEqual({ ok: false, message: 'Enter a weight from 30 to 300 kg.' })
  })

  it('turns pounds into kg', () => {
    expect(checkWeight('176', 'lb')).toEqual({ ok: true, value: 176 * KG_PER_LB })
  })

  it('keeps the pound limits inside the kg limits', () => {
    expect(WEIGHT_LIMITS_LB).toEqual({ min: 67, max: 661 })
    expect(checkWeight('66', 'lb').ok).toBe(false)
    expect(checkWeight('67', 'lb').ok).toBe(true)
    expect(checkWeight('661', 'lb').ok).toBe(true)
    expect(checkWeight('662', 'lb')).toEqual({ ok: false, message: 'Enter a weight from 67 to 661 lb.' })
  })

  it.each([
    ['175', 175],
    ['162.5', 162.5],
  ])('accepts a height of %j cm', (text, value) => {
    expect(checkHeight(text)).toEqual({ ok: true, value })
  })

  it.each(['', '99', '251', '5.9ft'])('rejects a height of %j', (text) => {
    expect(checkHeight(text)).toEqual({ ok: false, message: 'Enter a height from 100 to 250 cm.' })
  })

  it('gives the range in the unit being typed', () => {
    expect(weightHint('kg')).toBe('From 30 to 300 kg.')
    expect(weightHint('lb')).toBe('From 67 to 661 lb.')
  })
})

describe('weights and speeds in either unit', () => {
  it('shows a weight to one decimal at most', () => {
    expect(weightInUnit(80, 'kg')).toBe('80')
    expect(weightInUnit(80, 'lb')).toBe('176.4')
    expect(weightInUnit(176 * KG_PER_LB, 'lb')).toBe('176')
  })

  it('offers the three speeds, slowest first', () => {
    expect(LOSS_RATES).toEqual([0.25, 0.5, 0.75])
  })

  it.each([
    [0.25, '0.25 kg a week', '0.6 lb a week'],
    [0.5, '0.5 kg a week', '1.1 lb a week'],
    [0.75, '0.75 kg a week', '1.7 lb a week'],
  ] as const)('labels %s kg a week in both units', (rate, kg, lb) => {
    expect(speedLabel(rate, 'kg')).toBe(kg)
    expect(speedLabel(rate, 'lb')).toBe(lb)
  })

  it('sums up each goal', () => {
    expect(goalSummary({ kind: 'lose', kgPerWeek: 0.5 }, 'kg')).toBe('Lose 0.5 kg a week')
    expect(goalSummary({ kind: 'lose', kgPerWeek: 0.25 }, 'lb')).toBe('Lose 0.6 lb a week')
    expect(goalSummary({ kind: 'maintain' }, 'kg')).toBe('Keep my weight')
    expect(goalSummary({ kind: 'gain' }, 'kg')).toBe('Gain weight')
    expect(goalSummary({ kind: 'recomp' }, 'lb')).toBe('Body recomposition')
  })
})

describe('answers read back from the device', () => {
  it('keeps every valid answer', () => {
    expect(parseAnswers(JSON.parse(JSON.stringify(complete)))).toEqual(complete)
  })

  it('drops answers that are wrong, keeping the rest', () => {
    const parsed = parseAnswers({
      ageYears: 17,
      sex: 'other',
      weightKg: '80',
      weightUnit: 'stone',
      heightCm: 175,
      activity: 'toString',
      goal: { kind: 'lose', kgPerWeek: 1 },
    })
    expect(parsed).toEqual({ weightUnit: 'kg', heightCm: 175 })
  })

  it.each([[{ kind: 'lose' }], [{ kind: 'bulk' }], ['lose'], [null]])('drops a goal of %j', (goal) => {
    expect(parseAnswers({ goal }).goal).toBeUndefined()
  })

  it('drops an age that is not a whole number', () => {
    expect(parseAnswers({ ageYears: 30.5 }).ageYears).toBeUndefined()
  })

  it.each([null, 'answers', 42, []])('starts afresh from %j', (raw) => {
    expect(parseAnswers(raw)).toEqual(NO_ANSWERS)
  })
})

describe('keeping answers on the device', () => {
  it('saves and reads them back', () => {
    const storage = memoryStorage()
    saveAnswers(complete, storage)
    expect(readAnswers(storage)).toEqual(complete)
  })

  it('reads nothing as no answers, and corrupt JSON too', () => {
    expect(readAnswers(memoryStorage())).toEqual(NO_ANSWERS)
    expect(readAnswers(memoryStorage({ [FIRST_RUN_KEY]: '{not json' }))).toEqual(NO_ANSWERS)
  })

  it('clears them', () => {
    const storage = memoryStorage()
    saveAnswers(complete, storage)
    clearAnswers(storage)
    expect(storage.data.has(FIRST_RUN_KEY)).toBe(false)
  })

  it('carries on when storage is blocked', () => {
    expect(() => clearAnswers(throwing)).not.toThrow()
    expect(readAnswers(throwing)).toEqual(NO_ANSWERS)
    expect(() => saveAnswers(complete, throwing)).not.toThrow()
    expect(readAnswers(undefined)).toEqual(NO_ANSWERS)
  })

  it('is wiped with the rest of the user data at sign-out', () => {
    const storage = memoryStorage()
    saveAnswers(complete, storage)
    clearUserData(storage)
    expect(storage.data.size).toBe(0)
  })
})

describe('moving through the questions', () => {
  it('finds the first question still to answer', () => {
    expect(firstUnanswered(NO_ANSWERS)).toBe('age')
    expect(firstUnanswered({ ...NO_ANSWERS, ageYears: 30, sex: 'female' })).toBe('weight')
    expect(firstUnanswered({ ...complete, heightCm: undefined })).toBe('height')
    expect(firstUnanswered(complete)).toBeNull()
  })

  it('gives a profile only once every question is answered', () => {
    expect(toProfile({ ...complete, goal: undefined })).toBeNull()
    const profile = toProfile(complete)
    expect(profile).toEqual({
      ageYears: 30,
      sex: 'male',
      weightKg: 80,
      heightCm: 175,
      activity: 'light',
      goal: { kind: 'lose', kgPerWeek: 0.5 },
    })
    // The same example as the targets tests.
    expect(profile && dailyTargets(profile).kcal).toBe(2176)
  })
})
