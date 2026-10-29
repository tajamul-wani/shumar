import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context.ts'
import { getFoodSearch } from '../lib/foodSearch.ts'
import { LogError, limitMessage } from '../lib/logs.ts'
import {
  MAX_MY_FOODS,
  createMyFood,
  fetchMyFoods,
  removeMyFood,
  updateMyFood,
  type MyFood,
  type MyFoodInput,
} from '../lib/myFoods.ts'
import { forgetFood } from '../lib/recentFoods.ts'

export interface MyFoodsState {
  /** null until they have loaded; empty if they can't be read. */
  foods: MyFood[] | null
  add: (food: MyFoodInput) => Promise<MyFood>
  change: (id: string, food: MyFoodInput) => Promise<MyFood>
  remove: (food: MyFood) => Promise<void>
}

const byName = (foods: MyFood[]) => [...foods].sort((a, b) => a.name.localeCompare(b.name))

/**
 * The person's own foods, kept up to date on the screen as they add, change and remove them. Each
 * change also forgets the day's kept searches, and the food's place on the recent list, both of
 * which would still show it as it was.
 */
export function useMyFoods(): MyFoodsState {
  const { client, session } = useAuth()
  const userId = session?.user.id ?? ''
  const [foods, setFoods] = useState<MyFood[] | null>(null)

  useEffect(() => {
    let live = true
    fetchMyFoods(client).then(
      (next) => {
        if (live) setFoods(next)
      },
      () => {
        if (live) setFoods([])
      },
    )
    return () => {
      live = false
    }
  }, [client])

  const forget = useCallback(
    (id: string) => {
      getFoodSearch(client, userId).forget()
      forgetFood({ source: 'mine', sourceId: id })
    },
    [client, userId],
  )

  const add = useCallback(
    async (food: MyFoodInput) => {
      if ((foods?.length ?? 0) >= MAX_MY_FOODS) throw new LogError(limitMessage({ code: 'SH005' }) as string)
      const saved = await createMyFood(client, food)
      forget(saved.id)
      setFoods((list) => byName([...(list ?? []), saved]))
      return saved
    },
    [client, foods, forget],
  )

  const change = useCallback(
    async (id: string, food: MyFoodInput) => {
      const saved = await updateMyFood(client, id, food)
      forget(id)
      setFoods((list) => byName((list ?? []).map((entry) => (entry.id === id ? saved : entry))))
      return saved
    },
    [client, forget],
  )

  const remove = useCallback(
    async (food: MyFood) => {
      await removeMyFood(client, food.id)
      forget(food.id)
      setFoods((list) => (list ?? []).filter((entry) => entry.id !== food.id))
    },
    [client, forget],
  )

  return { foods, add, change, remove }
}
