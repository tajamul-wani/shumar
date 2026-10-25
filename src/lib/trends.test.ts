import { describe, expect, it, vi } from 'vitest'
import {
  fetchDailyTotals,
  formatRange,
  isCurrent,
  parseDailyTotals,
  rangeFor,
  shiftRange,
  summarizeRange,
  type DayTotal,
} from './trends.ts'

const sunday = new Date(2026, 9, 25) // Sunday, 25 October 2026
const targets = { kcal: 2176, protein: 128, carbs: 280, fat: 60 }
const day = (date: string, kcal: number, extra: Partial<DayTotal> = {}): DayTotal => ({
  date,
  kcal,
  protein: 100,
  carbs: 250,
  fat: 50,
  sodiumMg: 1500,
  foods: 3,
  ...extra,
})

describe('the week and the month', () => {
  it('runs a week from Monday to Sunday', () => {
    expect(rangeFor('week', sunday)).toEqual({ period: 'week', start: '2026-10-19', end: '2026-10-25' })
    expect(rangeFor('week', new Date(2026, 9, 19))).toEqual({
      period: 'week',
      start: '2026-10-19',
      end: '2026-10-25',
    })
    expect(rangeFor('week', new Date(2026, 9, 26))).toEqual({
      period: 'week',
      start: '2026-10-26',
      end: '2026-11-01',
    })
  })

  it('takes the calendar month, February included', () => {
    expect(rangeFor('month', sunday)).toEqual({ period: 'month', start: '2026-10-01', end: '2026-10-31' })
    expect(rangeFor('month', new Date(2028, 1, 10))).toEqual({
      period: 'month',
      start: '2028-02-01',
      end: '2028-02-29',
    })
  })

  it('moves a range back and forward, across month and year ends', () => {
    const week = rangeFor('week', sunday)
    expect(shiftRange(week, -1)).toEqual({ period: 'week', start: '2026-10-12', end: '2026-10-18' })
    expect(shiftRange(week, 1)).toEqual({ period: 'week', start: '2026-10-26', end: '2026-11-01' })
    const december = rangeFor('month', new Date(2026, 11, 15))
    expect(shiftRange(december, 1)).toEqual({ period: 'month', start: '2027-01-01', end: '2027-01-31' })
    expect(shiftRange(rangeFor('month', new Date(2027, 0, 5)), -1)).toEqual(december)
  })

  it('knows whether the range holds today', () => {
    expect(isCurrent(rangeFor('week', sunday), sunday)).toBe(true)
    expect(isCurrent(shiftRange(rangeFor('week', sunday), -1), sunday)).toBe(false)
  })

  it('names a range the way people say it', () => {
    expect(formatRange({ period: 'week', start: '2026-10-19', end: '2026-10-25' })).toBe('19 to 25 October')
    expect(formatRange({ period: 'week', start: '2026-10-26', end: '2026-11-01' })).toBe(
      '26 October to 1 November',
    )
    expect(formatRange({ period: 'month', start: '2026-10-01', end: '2026-10-31' })).toBe('October 2026')
  })
})

describe('reading the totals', () => {
  it('keeps the rows the database returns and drops anything odd', () => {
    expect(
      parseDailyTotals([
        {
          log_date: '2026-10-20',
          kcal: '1000',
          protein: '60',
          carbs: 110,
          fat: 30,
          sodium_mg: '1300',
          foods: 2,
        },
        { log_date: 'nope', kcal: 5 },
        null,
      ]),
    ).toEqual([
      { date: '2026-10-20', kcal: 1000, protein: 60, carbs: 110, fat: 30, sodiumMg: 1300, foods: 2 },
    ])
    expect(parseDailyTotals(null)).toEqual([])
  })

  it('asks the database for the range and explains a failure plainly', async () => {
    const rpc = vi
      .fn<() => Promise<{ data: unknown; error: null | { message: string } }>>()
      .mockResolvedValueOnce({ data: [{ log_date: '2026-10-20', kcal: 1 }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
    const range = { period: 'week' as const, start: '2026-10-19', end: '2026-10-25' }
    expect(await fetchDailyTotals({ rpc } as never, range)).toHaveLength(1)
    expect(rpc).toHaveBeenCalledWith('daily_totals', { from_date: '2026-10-19', to_date: '2026-10-25' })
    await expect(fetchDailyTotals({ rpc } as never, range)).rejects.toThrow(
      "We couldn't load your trends. Check your connection and try again.",
    )
  })
})

describe('what a range adds up to', () => {
  const week = { period: 'week' as const, start: '2026-10-19', end: '2026-10-25' }
  const totals = [
    day('2026-10-19', 1940),
    day('2026-10-20', 2310),
    day('2026-10-21', 1860),
    day('2026-10-22', 2050),
    day('2026-10-24', 2420, { protein: 150 }),
    day('2026-10-25', 1780),
  ]

  it('gives every day a bar, marks the ones over target and the ones with nothing', () => {
    const summary = summarizeRange(week, totals, targets, sunday)
    expect(summary.days.map((d) => [d.label, d.state, d.over])).toEqual([
      ['Mon', 'logged', false],
      ['Tue', 'logged', true],
      ['Wed', 'logged', false],
      ['Thu', 'logged', false],
      ['Fri', 'empty', false],
      ['Sat', 'logged', true],
      ['Sun', 'logged', false],
    ])
    expect(summary.daysSoFar).toBe(7)
    expect(summary.logged).toBe(6)
    expect(summary.over).toBe(2)
    expect(summary.averageKcal).toBeCloseTo(2060, 5)
    expect(summary.macros.map((m) => [m.key, Math.round(m.average * 10) / 10, m.target])).toEqual([
      ['protein', 108.3, 128],
      ['carbs', 250, 280],
      ['fat', 50, 60],
    ])
  })

  it('marks days still to come and counts only the days so far', () => {
    const wednesday = new Date(2026, 9, 21)
    const summary = summarizeRange(week, totals.slice(0, 3), targets, wednesday)
    expect(summary.days.map((d) => d.state)).toEqual([
      'logged',
      'logged',
      'logged',
      'ahead',
      'ahead',
      'ahead',
      'ahead',
    ])
    expect(summary.daysSoFar).toBe(3)
    expect(summary.logged).toBe(3)
  })

  it('has no average, no over days and no macro lines without a target or without logs', () => {
    expect(summarizeRange(week, [], targets, sunday)).toMatchObject({
      logged: 0,
      over: 0,
      averageKcal: null,
      macros: [],
    })
    const noTarget = summarizeRange(week, totals, null, sunday)
    expect(noTarget.over).toBe(0)
    expect(noTarget.macros).toEqual([])
    expect(noTarget.averageKcal).toBeCloseTo(2060, 5)
  })

  it('labels a month by the day of the month', () => {
    const month = { period: 'month' as const, start: '2026-10-01', end: '2026-10-31' }
    const summary = summarizeRange(month, totals, targets, sunday)
    expect(summary.days).toHaveLength(31)
    expect(summary.days[0].label).toBe('1')
    expect(summary.days[30].state).toBe('ahead')
    expect(summary.daysSoFar).toBe(25)
  })
})
