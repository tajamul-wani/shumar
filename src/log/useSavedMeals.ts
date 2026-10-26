import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context.ts'
import { LogError, type FoodAmount } from '../lib/logs.ts'
import {
  MAX_SAVED_MEALS,
  addSavedMealFood,
  fetchSavedMeals,
  removeSavedMeal,
  removeSavedMealFood,
  saveMeal,
  type SavedMeal,
} from '../lib/savedMeals.ts'

export interface SavedMealsState {
  /** null until they have loaded; empty if they can't be read. */
  meals: SavedMeal[] | null
  save: (name: string, foods: readonly FoodAmount[]) => Promise<SavedMeal>
  remove: (meal: SavedMeal) => Promise<void>
  addFood: (meal: SavedMeal, food: FoodAmount) => Promise<SavedMeal>
  /** The meal as it is now, or null when its last food went and the meal with it. */
  removeFood: (meal: SavedMeal, foodId: string) => Promise<SavedMeal | null>
}

const byName = (meals: SavedMeal[]) => [...meals].sort((a, b) => a.name.localeCompare(b.name))

/** The person's saved meals, kept up to date on the screen as they save, change and remove them. */
export function useSavedMeals(): SavedMealsState {
  const { client } = useAuth()
  const [meals, setMeals] = useState<SavedMeal[] | null>(null)

  useEffect(() => {
    let live = true
    fetchSavedMeals(client).then(
      (next) => {
        if (live) setMeals(next)
      },
      () => {
        if (live) setMeals([])
      },
    )
    return () => {
      live = false
    }
  }, [client])

  const save = useCallback(
    async (name: string, foods: readonly FoodAmount[]) => {
      if ((meals?.length ?? 0) >= MAX_SAVED_MEALS) {
        throw new LogError(`You have ${MAX_SAVED_MEALS} saved meals. Remove one to save another.`)
      }
      const saved = await saveMeal(client, name, foods)
      setMeals((list) => byName([...(list ?? []), saved]))
      return saved
    },
    [client, meals],
  )

  const remove = useCallback(
    async (meal: SavedMeal) => {
      await removeSavedMeal(client, meal.id)
      setMeals((list) => (list ?? []).filter((entry) => entry.id !== meal.id))
    },
    [client],
  )

  const replace = useCallback(
    (next: SavedMeal) =>
      setMeals((list) => (list ?? []).map((entry) => (entry.id === next.id ? next : entry))),
    [],
  )

  const addFood = useCallback(
    async (meal: SavedMeal, food: FoodAmount) => {
      const next = await addSavedMealFood(client, meal, food)
      replace(next)
      return next
    },
    [client, replace],
  )

  const removeFood = useCallback(
    async (meal: SavedMeal, foodId: string) => {
      const next = await removeSavedMealFood(client, meal, foodId)
      if (next) replace(next)
      else setMeals((list) => (list ?? []).filter((entry) => entry.id !== meal.id))
      return next
    },
    [client, replace],
  )

  return { meals, save, remove, addFood, removeFood }
}
