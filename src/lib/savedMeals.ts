import type { SupabaseClient } from '@supabase/supabase-js'
import { LogError, foodAmountColumns, parseFoodAmount, textUpTo, type FoodAmount } from './logs.ts'

/**
 * Saved meals: a named group of foods a person eats together, added to a meal in one tap. Each
 * food keeps the amount and nutrients it was saved with. Row-level security limits every query
 * to the signed-in person's own saved meals.
 */

export const MAX_SAVED_MEALS = 20
export const MAX_SAVED_MEAL_FOODS = 30
export const MAX_SAVED_MEAL_NAME = 40

/** A food in a saved meal, with its own id so it can be removed on its own, and its place in the meal. */
export interface SavedFood extends FoodAmount {
  id: string
  position: number
}

export interface SavedMeal {
  id: string
  name: string
  foods: SavedFood[]
}

type SavedMealsClient = Pick<SupabaseClient, 'from'>

const FOOD_COLUMNS =
  'id, position, food_name, food_source, food_source_id, quantity, unit_name, grams, kcal, protein, carbs, fat, sodium_mg'
const COLUMNS = `id, name, saved_meal_foods (${FOOD_COLUMNS})`

/** A saved meal's name as the database takes it: one line, no spaces around it, or null if unusable. */
export function normalizeSavedMealName(name: string): string | null {
  const trimmed = name.replace(/\s+/g, ' ').trim()
  return trimmed.length >= 1 && trimmed.length <= MAX_SAVED_MEAL_NAME ? trimmed : null
}

/** Checks one saved_meals row with its foods. A meal with no usable food is dropped: there is nothing to add. */
export function parseSavedMeal(value: unknown): SavedMeal | null {
  const row = (value ?? {}) as Record<string, unknown>
  const id = textUpTo(row.id, 64)
  const name = typeof row.name === 'string' ? normalizeSavedMealName(row.name) : null
  if (!id || !name || !Array.isArray(row.saved_meal_foods)) return null
  const foods = row.saved_meal_foods
    .map((entry) => {
      const foodRow = (entry ?? {}) as Record<string, unknown>
      const food = parseFoodAmount(foodRow)
      const foodId = textUpTo(foodRow.id, 64)
      const position = Number(foodRow.position)
      return food && foodId && Number.isInteger(position) && position >= 1
        ? { id: foodId, position, ...food }
        : null
    })
    .filter((food): food is SavedFood => food !== null)
    .sort((a, b) => a.position - b.position)
  return foods.length > 0 ? { id, name, foods } : null
}

/** Every saved meal this person has, by name. */
export async function fetchSavedMeals(client: SavedMealsClient): Promise<SavedMeal[]> {
  const { data, error } = await client.from('saved_meals').select(COLUMNS).order('name')
  if (error) throw new LogError("We couldn't load your saved meals. Check your connection and try again.")
  if (!Array.isArray(data)) return []
  return data.map(parseSavedMeal).filter((meal): meal is SavedMeal => meal !== null)
}

/** Saves a group of foods under a name. Its foods are copies: later changes to the logs never touch it. */
export async function saveMeal(
  client: SavedMealsClient,
  name: string,
  foods: readonly FoodAmount[],
): Promise<SavedMeal> {
  const cleanName = normalizeSavedMealName(name)
  if (!cleanName) throw new LogError(`Give the meal a name of up to ${MAX_SAVED_MEAL_NAME} characters.`)
  if (foods.length === 0) throw new LogError('Add a food to the meal first.')
  if (foods.length > MAX_SAVED_MEAL_FOODS) {
    throw new LogError(`A saved meal holds up to ${MAX_SAVED_MEAL_FOODS} foods.`)
  }
  const created = await client.from('saved_meals').insert({ name: cleanName }).select('id').single()
  const id = created.error ? null : textUpTo((created.data as { id?: unknown } | null)?.id, 64)
  if (!id) {
    if (created.error?.code === '23505')
      throw new LogError(`You already have a saved meal called ${cleanName}.`)
    throw new LogError("We couldn't save this meal. Check your connection and try again.")
  }
  const rows = foods.map((food, index) => ({
    saved_meal_id: id,
    position: index + 1,
    ...foodAmountColumns(food),
  }))
  const { data, error } = await client.from('saved_meal_foods').insert(rows).select('id')
  const ids = error ? null : foodIds(data, rows.length)
  if (!ids) {
    // Leave no empty saved meal behind. If this fails too, the empty meal is dropped when read.
    await client.from('saved_meals').delete().eq('id', id)
    throw new LogError("We couldn't save this meal. Check your connection and try again.")
  }
  return {
    id,
    name: cleanName,
    foods: foods.map((food, index) => savedFood(ids[index], index + 1, food)),
  }
}

/**
 * A saved food from the fields a food amount holds and nothing else: a logged food brings its own
 * id along, and that must never stand in for the saved food's.
 */
function savedFood(id: string, position: number, food: FoodAmount): SavedFood {
  const { foodName, foodSource, foodSourceId, quantity, unitName, grams, nutrients } = food
  return {
    id,
    position,
    foodName,
    foodSource,
    foodSourceId,
    quantity,
    unitName,
    grams,
    nutrients: { ...nutrients },
  }
}

/** The ids an insert into saved_meal_foods returns, one per row, or null if anything is off. */
function foodIds(data: unknown, count: number): string[] | null {
  if (!Array.isArray(data) || data.length !== count) return null
  const ids = data.map((row) => textUpTo((row as { id?: unknown } | null)?.id, 64))
  return ids.every((foodId): foodId is string => foodId !== null) ? ids : null
}

/** Puts one more food at the end of a saved meal, and returns the meal as it is now. */
export async function addSavedMealFood(
  client: SavedMealsClient,
  meal: SavedMeal,
  food: FoodAmount,
): Promise<SavedMeal> {
  if (meal.foods.length >= MAX_SAVED_MEAL_FOODS) {
    throw new LogError(`A saved meal holds up to ${MAX_SAVED_MEAL_FOODS} foods.`)
  }
  // After the last one, whatever was removed before: places are never reused.
  const position = Math.max(0, ...meal.foods.map((saved) => saved.position)) + 1
  const { data, error } = await client
    .from('saved_meal_foods')
    .insert({ saved_meal_id: meal.id, position, ...foodAmountColumns(food) })
    .select('id')
    .single()
  const id = error ? null : textUpTo((data as { id?: unknown } | null)?.id, 64)
  if (!id) {
    throw new LogError(`We couldn't add this food to ${meal.name}. Check your connection and try again.`)
  }
  return { ...meal, foods: [...meal.foods, savedFood(id, position, food)] }
}

/**
 * Takes one food out of a saved meal, and returns the meal as it is now. Taking out the last food
 * removes the saved meal itself: a saved meal with nothing in it has nothing to add.
 */
export async function removeSavedMealFood(
  client: SavedMealsClient,
  meal: SavedMeal,
  foodId: string,
): Promise<SavedMeal | null> {
  const left = meal.foods.filter((food) => food.id !== foodId)
  if (left.length === 0) {
    await removeSavedMeal(client, meal.id)
    return null
  }
  const { data, error } = await client.from('saved_meal_foods').delete().eq('id', foodId).select('id')
  if (error || !Array.isArray(data) || data.length === 0) {
    throw new LogError(`We couldn't remove this food from ${meal.name}. Check your connection and try again.`)
  }
  return { ...meal, foods: left }
}

export async function removeSavedMeal(client: SavedMealsClient, id: string): Promise<void> {
  const { data, error } = await client.from('saved_meals').delete().eq('id', id).select('id')
  if (error || !Array.isArray(data) || data.length === 0) {
    throw new LogError("We couldn't remove this saved meal. Check your connection and try again.")
  }
}
