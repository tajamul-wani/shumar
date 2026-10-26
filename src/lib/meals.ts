/** The five meals every day starts with, as user_logs.meal stores them, in the order of the day. */
export const FIXED_MEALS = ['breakfast', 'lunch', 'evening_tea', 'dinner', 'snack'] as const

export type FixedMeal = (typeof FIXED_MEALS)[number]

/**
 * A meal: one of the five fixed keys, or a short name of the person's own ("Chai", "Pre-workout"),
 * stored as typed. The database allows 1 to 30 characters on one line with no spaces around them.
 */
export type Meal = FixedMeal | (string & {})

/** Kept for the code that lists the fixed meals. */
export const MEALS: readonly FixedMeal[] = FIXED_MEALS

export const MEAL_LABELS: Record<FixedMeal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  evening_tea: 'Evening tea',
  dinner: 'Dinner',
  snack: 'Snack',
}

export const MAX_MEAL_NAME = 30

export function isFixedMeal(value: unknown): value is FixedMeal {
  return typeof value === 'string' && (FIXED_MEALS as readonly string[]).includes(value)
}

/** True for a fixed meal or a name the database would accept. */
export function isMeal(value: unknown): value is Meal {
  if (typeof value !== 'string') return false
  if (isFixedMeal(value)) return true
  return (
    value.length >= 1 && value.length <= MAX_MEAL_NAME && value === value.trim() && !/[\n\r\t]/.test(value)
  )
}

/** What a meal is called on screen: the fixed label, or the person's own name as they typed it. */
export function mealLabel(meal: Meal): string {
  return isFixedMeal(meal) ? MEAL_LABELS[meal] : meal
}

/** The meal in the middle of a sentence: "lunch", "evening tea", or the person's own name as is. */
export function mealPhrase(meal: Meal): string {
  return isFixedMeal(meal) ? MEAL_LABELS[meal].toLowerCase() : meal
}

/**
 * A meal name as typed, made storable: spaces trimmed and collapsed, and a fixed meal's label
 * ("lunch", "Evening Tea") turned back into its key so it joins that meal. Null when nothing
 * usable is left or it is too long.
 */
export function normalizeMealName(raw: string): Meal | null {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (name === '' || name.length > MAX_MEAL_NAME) return null
  const fixed = FIXED_MEALS.find((meal) => MEAL_LABELS[meal].toLowerCase() === name.toLowerCase())
  return fixed ?? name
}

/** The fixed meals in the order of the day, then the person's own meals in the order given. */
export function sortMeals<T>(items: readonly T[], mealOf: (item: T) => Meal): T[] {
  const rank = (meal: Meal) => (isFixedMeal(meal) ? FIXED_MEALS.indexOf(meal) : FIXED_MEALS.length)
  return [...items].sort((a, b) => rank(mealOf(a)) - rank(mealOf(b)))
}

/**
 * The meal the log sheet opens on: breakfast until 11:00, lunch until 16:00, evening tea
 * until 19:00, dinner after that (decided 21 October 2026). Snack is only chosen by hand.
 */
export function defaultMeal(now: Date): FixedMeal {
  const hour = now.getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 19) return 'evening_tea'
  return 'dinner'
}
