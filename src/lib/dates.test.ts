import { describe, expect, it } from 'vitest'
import { formatDayHeading } from './dates.ts'

describe('formatDayHeading', () => {
  it('shows the weekday, then the day and month', () => {
    expect(formatDayHeading(new Date(2026, 9, 17))).toBe('Saturday, 17 October')
  })

  it('uses the local day, not UTC', () => {
    expect(formatDayHeading(new Date(2026, 10, 9, 23, 59))).toBe('Monday, 9 November')
  })
})
