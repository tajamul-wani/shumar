/**
 * A short note for the day, shown beside the ring on wide screens. Written for Shumār in its
 * own voice: plain, about the habit of writing food down, never a diet rule or a borrowed quote.
 * The day of the year picks the note, so everyone sees the same one on the same day and it
 * changes at midnight.
 */
export const DAILY_NOTES: readonly string[] = [
  'One honest day of logging teaches more than a week of guessing.',
  'Girda and nun chai count. Write them down and the day stops being a mystery.',
  'Over the target is a number, not a verdict. Tomorrow starts from zero.',
  'A logged meal is a decision you can see.',
  'You do not need a perfect day. You need a recorded one.',
  'The scale wobbles from day to day. The log does not.',
  'Three ordinary meals, written down, beat one heroic one.',
  'Skipped a meal? Log the next one. The habit is about honesty, not hunger.',
  'Look at the week, not the hour.',
  'Kashmiri food fits a target. It only needed weighing once.',
  'Protein first. The rest of the day tends to follow.',
  'Enough is a number now, and you know it.',
  'Small plates add up. So do small logs.',
  'What you ate at evening tea is part of dinner, whether or not you wrote it down.',
]

/** The day of the year, 0 for 1 January, on this machine's calendar. */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1)
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((today.getTime() - start.getTime()) / 86_400_000)
}

/** The note for a date: the same for everyone that day, the next one the day after. */
export function noteForDay(date: Date): string {
  return DAILY_NOTES[dayOfYear(date) % DAILY_NOTES.length]
}

/** What the last seven days say, in two plain lines under the note. */
export function weekLines(
  logged: number,
  daysSoFar: number,
  yesterday: { kcal: number } | null,
  targetKcal: number | null,
): string[] {
  const days = `${logged} of ${daysSoFar} days logged in the last week.`
  if (!yesterday) return [days, 'Yesterday: nothing logged.']
  const kcal = Math.round(yesterday.kcal)
  if (!targetKcal) return [days, `Yesterday: ${kcal.toLocaleString('en-IN')} kcal.`]
  const gap = Math.round(targetKcal - kcal)
  const standing =
    gap === 0
      ? 'right on target'
      : gap > 0
        ? `${gap.toLocaleString('en-IN')} under target`
        : `${(-gap).toLocaleString('en-IN')} over target`
  return [days, `Yesterday: ${kcal.toLocaleString('en-IN')} kcal, ${standing}.`]
}
