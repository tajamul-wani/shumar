export type Meal = 'breakfast' | 'lunch' | 'evening_tea' | 'dinner' | 'snack'

/** The meals in the order the day goes, matching the user_logs.meal values. */
export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'evening_tea', 'dinner', 'snack']

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  evening_tea: 'Evening tea',
  dinner: 'Dinner',
  snack: 'Snack',
}

export function isMeal(value: unknown): value is Meal {
  return typeof value === 'string' && (MEALS as readonly string[]).includes(value)
}

/**
 * The meal the log sheet opens on: breakfast until 11:00, lunch until 16:00, evening tea
 * until 19:00, dinner after that (decided 21 October 2026). Snack is only chosen by hand.
 */
export function defaultMeal(now: Date): Meal {
  const hour = now.getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 19) return 'evening_tea'
  return 'dinner'
}
