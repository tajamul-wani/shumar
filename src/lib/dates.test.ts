import { describe, expect, it } from 'vitest'
import { formatDayHeading, localDateKey } from './dates.ts'

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
