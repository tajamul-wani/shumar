const DAY_HEADING = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

/** The day as Shumār shows it at the top of a screen, for example "Saturday, 17 October". */
export function formatDayHeading(date: Date): string {
  return DAY_HEADING.format(date)
}
