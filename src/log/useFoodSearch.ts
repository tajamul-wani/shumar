import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/context.ts'
import { MIN_QUERY_LENGTH, getFoodSearch, normalizeQuery, type FoodResult } from '../lib/foodSearch.ts'

export type FoodSearchState =
  | { status: 'idle' }
  /** previous holds the last results while the next ones load, so the list doesn't jump. */
  | { status: 'loading'; query: string; previous: FoodResult[] | null }
  | { status: 'done'; query: string; results: FoodResult[] }
  | { status: 'error'; query: string }

interface Answer {
  query: string
  round: number
  results: FoodResult[] | null
}

/**
 * Searches as the person types, waiting until they pause (300 ms) so each word costs one
 * request, and cancelling a search that is no longer wanted. A new round searches again for the
 * same words, as after the person adds, changes or removes a food of their own.
 */
export function useFoodSearch(raw: string, delay = 300, round = 0): FoodSearchState {
  const { client, session } = useAuth()
  const userId = session?.user.id ?? ''
  const search = useMemo(() => getFoodSearch(client, userId), [client, userId])
  const query = normalizeQuery(raw)
  const [answer, setAnswer] = useState<Answer | null>(null)

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      search.search(query, controller.signal).then(
        (results) => {
          if (!controller.signal.aborted) setAnswer({ query, round, results })
        },
        () => {
          if (!controller.signal.aborted) setAnswer({ query, round, results: null })
        },
      )
    }, delay)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, search, delay, round])

  if (query.length < MIN_QUERY_LENGTH) return { status: 'idle' }
  if (answer?.query !== query || answer.round !== round) {
    // Keep the old list only while someone types on or deletes, never for an unrelated search, and
    // never one from before a food of their own changed, which would show it as it was.
    const related =
      answer && answer.round === round && (query.startsWith(answer.query) || answer.query.startsWith(query))
    return { status: 'loading', query, previous: related ? answer.results : null }
  }
  if (answer.results === null) return { status: 'error', query }
  return { status: 'done', query, results: answer.results }
}
