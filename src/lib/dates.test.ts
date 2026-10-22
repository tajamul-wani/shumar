import { describe, expect, it } from 'vitest'
import { formatDayHeading, formatMealTime, localDateKey } from './dates.ts'

describe('formatDayHeading', () => {
  it('shows the weekday, then the day and month', () => {
    expect(formatDayHeading(new Date(2026, 9, 17))).toBe('Saturday, 17 October')
  })

  it('uses the local day, not UTC', () => {
    expect(formatDayHeading(new Date(2026, 10, 9, 23, 59))).toBe('Monday, 9 November')
  })
})

describe('localDateKey', () => {
  it('gives the local calendar day, padded', () => {
    expect(localDateKey(new Date(2026, 0, 5, 9, 0))).toBe('2026-01-05')
  })

  it('keeps a meal just after midnight on the new day', () => {
    expect(localDateKey(new Date(2026, 9, 22, 0, 15))).toBe('2026-10-22')
  })
})

describe('formatMealTime', () => {
  it('shows 24-hour time without a leading zero', () => {
    expect(formatMealTime(new Date(2026, 9, 21, 8, 10))).toBe('8:10')
    expect(formatMealTime(new Date(2026, 9, 21, 20, 45))).toBe('20:45')
    expect(formatMealTime(new Date(2026, 9, 21, 0, 5))).toBe('0:05')
  })
})
