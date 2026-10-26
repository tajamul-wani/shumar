import { describe, expect, it } from 'vitest'
import { DAILY_NOTES, noteForDay, weekLines } from './notes.ts'

describe('the note for the day', () => {
  it('is the same all day and changes at midnight', () => {
    const morning = new Date(2026, 9, 26, 8, 0)
    const night = new Date(2026, 9, 26, 23, 59)
    const tomorrow = new Date(2026, 9, 27, 0, 1)
    expect(noteForDay(morning)).toBe(noteForDay(night))
    expect(noteForDay(tomorrow)).not.toBe(noteForDay(morning))
  })

  it('goes round every note before repeating, starting from 1 January', () => {
    const seen = new Set<string>()
    for (let day = 0; day < DAILY_NOTES.length; day += 1) {
      seen.add(noteForDay(new Date(2026, 0, 1 + day)))
    }
    expect(seen.size).toBe(DAILY_NOTES.length)
    expect(noteForDay(new Date(2026, 0, 1))).toBe(DAILY_NOTES[0])
    expect(noteForDay(new Date(2026, 0, 1 + DAILY_NOTES.length))).toBe(DAILY_NOTES[0])
  })

  it('keeps every note short, plain and free of dashes', () => {
    for (const note of DAILY_NOTES) {
      expect(note.length).toBeLessThanOrEqual(90)
      expect(note).not.toMatch(new RegExp('[\u2013\u2014]'))
      expect(note.trim()).toBe(note)
    }
  })
})

describe('the lines about the last week', () => {
  it('counts the days and says how yesterday went against the target', () => {
    expect(weekLines(5, 7, { kcal: 1920 }, 2176)).toEqual([
      '5 of 7 days logged in the last week.',
      'Yesterday: 1,920 kcal, 256 under target.',
    ])
    expect(weekLines(3, 7, { kcal: 2500.4 }, 2176)[1]).toBe('Yesterday: 2,500 kcal, 324 over target.')
    expect(weekLines(3, 7, { kcal: 2176 }, 2176)[1]).toBe('Yesterday: 2,176 kcal, right on target.')
  })

  it('copes without a target and without a yesterday', () => {
    expect(weekLines(2, 7, { kcal: 1500 }, null)[1]).toBe('Yesterday: 1,500 kcal.')
    expect(weekLines(0, 7, null, 2176)).toEqual([
      '0 of 7 days logged in the last week.',
      'Yesterday: nothing logged.',
    ])
  })
})
