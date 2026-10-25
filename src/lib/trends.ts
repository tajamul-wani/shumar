import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, localDateKey, parseDateKey } from './dates.ts'
import { LogError } from './logs.ts'
import type { MacroKey } from './today.ts'

/**
 * The Trends screen: a week (Monday to Sunday) or a calendar month, each day's totals from the
 * database, and what they add up to. Kept apart from the screen so it can be tested.
 */

export type Period = 'week' | 'month'

export interface DayTotal {
  /** The local calendar day, YYYY-MM-DD. */
  date: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  sodiumMg: number
  /** How many foods were logged that day. */
  foods: number
}

export interface DateRange {
  period: Period
  /** YYYY-MM-DD, inclusive. */
  start: string
  end: string
}

/** The week or month holding `date`. Weeks run Monday to Sunday. */
export function rangeFor(period: Period, date: Date): DateRange {
  if (period === 'month') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    return { period, start: localDateKey(start), end: localDateKey(end) }
  }
  const monday = addDays(date, -((date.getDay() + 6) % 7))
  return { period, start: localDateKey(monday), end: localDateKey(addDays(monday, 6)) }
}

/** The range before or after this one. */
export function shiftRange(range: DateRange, by: -1 | 1): DateRange {
  const start = parseDateKey(range.start)
  if (range.period === 'month')
    return rangeFor('month', new Date(start.getFullYear(), start.getMonth() + by, 1))
  return rangeFor('week', addDays(start, 7 * by))
}

/** True when `today` falls inside the range, so there is no later one to show yet. */
export function isCurrent(range: DateRange, today: Date): boolean {
  const key = localDateKey(today)
  return key >= range.start && key <= range.end
}

const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long' })
const MONTH_YEAR = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })

/** "19 to 25 October", "27 October to 2 November", or "October 2026". */
export function formatRange(range: DateRange): string {
  const start = parseDateKey(range.start)
  const end = parseDateKey(range.end)
  if (range.period === 'month') return MONTH_YEAR.format(start)
  if (start.getMonth() === end.getMonth())
    return `${start.getDate()} to ${end.getDate()} ${MONTH.format(end)}`
  return `${start.getDate()} ${MONTH.format(start)} to ${end.getDate()} ${MONTH.format(end)}`
}

function number(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0
}

/** Checks the rows the database returns. A row with no date is left out. */
export function parseDailyTotals(rows: unknown): DayTotal[] {
  if (!Array.isArray(rows)) return []
  const totals: DayTotal[] = []
  for (const row of rows as Record<string, unknown>[]) {
    if (typeof row?.log_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.log_date)) continue
    totals.push({
      date: row.log_date,
      kcal: number(row.kcal),
      protein: number(row.protein),
      carbs: number(row.carbs),
      fat: number(row.fat),
      sodiumMg: number(row.sodium_mg),
      foods: Math.round(number(row.foods)),
    })
  }
  return totals
}

/** Each day's totals in the range, oldest first. Days with nothing logged are not returned. */
export async function fetchDailyTotals(
  client: Pick<SupabaseClient, 'rpc'>,
  range: DateRange,
): Promise<DayTotal[]> {
  const { data, error } = await client.rpc('daily_totals', { from_date: range.start, to_date: range.end })
  if (error) throw new LogError("We couldn't load your trends. Check your connection and try again.")
  return parseDailyTotals(data)
}

export type DayState = 'logged' | 'empty' | 'ahead'

export interface DayBar {
  date: string
  /** The day of the month, or the weekday on a week view. */
  label: string
  kcal: number
  /** Logged, nothing logged, or still to come. */
  state: DayState
  over: boolean
}

export interface MacroAverage {
  key: MacroKey
  average: number
  target: number
}

export interface RangeSummary {
  days: DayBar[]
  /** Days in the range up to today. */
  daysSoFar: number
  logged: number
  over: number
  /** Calories per logged day, or null with nothing logged. */
  averageKcal: number | null
  /** Each macro's average per logged day against its target, or an empty list without a target. */
  macros: MacroAverage[]
}

const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })

/** What the range adds up to, with a bar for every day in it. */
export function summarizeRange(
  range: DateRange,
  totals: readonly DayTotal[],
  targets: Pick<DayTotal, 'kcal' | 'protein' | 'carbs' | 'fat'> | null,
  today: Date,
): RangeSummary {
  const byDate = new Map(totals.map((t) => [t.date, t]))
  const todayKey = localDateKey(today)
  const days: DayBar[] = []
  for (let d = parseDateKey(range.start); localDateKey(d) <= range.end; d = addDays(d, 1)) {
    const key = localDateKey(d)
    const total = byDate.get(key)
    const label = range.period === 'week' ? WEEKDAY.format(d) : String(d.getDate())
    const state: DayState = key > todayKey ? 'ahead' : total ? 'logged' : 'empty'
    days.push({
      date: key,
      label,
      kcal: total?.kcal ?? 0,
      state,
      over: !!total && !!targets && total.kcal > targets.kcal,
    })
  }
  const logged = totals.filter((t) => t.date >= range.start && t.date <= range.end && t.date <= todayKey)
  const sum = (key: 'kcal' | 'protein' | 'carbs' | 'fat') => logged.reduce((s, t) => s + t[key], 0)
  const macros: MacroAverage[] =
    targets && logged.length
      ? (['protein', 'carbs', 'fat'] as const).map((key) => ({
          key,
          average: sum(key) / logged.length,
          target: targets[key],
        }))
      : []
  return {
    days,
    daysSoFar: days.filter((day) => day.state !== 'ahead').length,
    logged: logged.length,
    over: days.filter((day) => day.over).length,
    averageKcal: logged.length ? sum('kcal') / logged.length : null,
    macros,
  }
}

const WEEKDAY_LONG = new Intl.DateTimeFormat('en-IN', { weekday: 'long' })
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const count = (n: number, noun: string) => `${WORDS[n] ?? n} ${noun}${n === 1 ? '' : 's'}`
const whole = (n: number) => Math.round(n).toLocaleString('en-IN')

/** The short note under the charts, in the review card's voice: what was missing, over and behind. */
export function describeRange(
  range: DateRange,
  summary: RangeSummary,
  targetKcal: number | null,
  today: Date,
): { title: string; text: string } {
  const current = isCurrent(range, today)
  const monthName = MONTH.format(parseDateKey(range.start))
  const title =
    range.period === 'week'
      ? current
        ? 'This week'
        : 'That week'
      : current
        ? `${monthName} so far`
        : monthName
  const parts: string[] = []
  const empty = summary.days.filter((d) => d.state === 'empty')
  if (summary.daysSoFar === 0) return { title, text: 'Nothing to show yet.' }
  if (summary.logged === 0) return { title, text: 'Nothing logged on these days.' }
  if (empty.length === 1 && range.period === 'week') {
    parts.push(`${WEEKDAY_LONG.format(parseDateKey(empty[0].date))} has nothing logged.`)
  } else if (empty.length > 0) {
    parts.push(
      `${count(empty.length, 'day')[0].toUpperCase()}${count(empty.length, 'day').slice(1)} ${empty.length === 1 ? 'has' : 'have'} nothing logged.`,
    )
  }
  const over = summary.days.filter((d) => d.over)
  if (targetKcal && over.length === 1 && range.period === 'week') {
    parts.push(
      `${WEEKDAY_LONG.format(parseDateKey(over[0].date))} went ${whole(over[0].kcal - targetKcal)} kcal over.`,
    )
  } else if (targetKcal && over.length > 1) {
    parts.push(
      `${count(over.length, 'day')[0].toUpperCase()}${count(over.length, 'day').slice(1)} went over the target.`,
    )
  }
  if (summary.averageKcal !== null && targetKcal) {
    const gap = Math.round(targetKcal - summary.averageKcal)
    const where =
      gap === 0
        ? 'right on your target'
        : gap > 0
          ? `${whole(gap)} under your target`
          : `${whole(-gap)} over your target`
    parts.push(`The days you logged average ${whole(summary.averageKcal)} kcal, ${where}.`)
  } else if (summary.averageKcal !== null) {
    parts.push(`The days you logged average ${whole(summary.averageKcal)} kcal.`)
  }
  const behind = summary.macros
    .map((m) => ({ ...m, share: m.target > 0 ? m.average / m.target : 1 }))
    .filter((m) => m.share < 1)
    .sort((a, b) => a.share - b.share)[0]
  if (behind) {
    const names = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' } as const
    parts.push(
      `${names[behind.key]} ${behind.key === 'carbs' ? 'were' : 'was'} the macro furthest behind, at ${Math.round(behind.share * 100)}% of its target.`,
    )
  }
  return { title, text: parts.join(' ') }
}
