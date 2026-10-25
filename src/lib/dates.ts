const DAY_HEADING = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

/** The day as Shumār shows it at the top of a screen, for example "Saturday, 17 October". */
export function formatDayHeading(date: Date): string {
  return DAY_HEADING.format(date)
}

/**
 * The calendar day on this device, as YYYY-MM-DD. Logs are dated with this rather than the
 * server's date, which is UTC: Kashmir is 5.5 hours ahead, so a late-night meal would
 * otherwise land on the previous day.
 */
export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A 24-hour time without a leading zero, such as "8:10" or "20:45", as the meal list shows it. */
export function formatMealTime(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** The local midnight of a YYYY-MM-DD key, the reverse of localDateKey. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** The same time of day, `days` later (or earlier when negative), across month ends and clock changes. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
