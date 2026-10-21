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
  results: FoodResult[] | null
}

/**
 * Searches as the person types, waiting until they pause (300 ms) so each word costs one
 * request, and cancelling a search that is no longer wanted.
 */
export function useFoodSearch(raw: string, delay = 300): FoodSearchState {
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
          if (!controller.signal.aborted) setAnswer({ query, results })
        },
        () => {
          if (!controller.signal.aborted) setAnswer({ query, results: null })
        },
      )
    }, delay)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, search, delay])

  if (query.length < MIN_QUERY_LENGTH) return { status: 'idle' }
  if (answer?.query !== query) {
    // Keep the old list only while someone types on or deletes, never for an unrelated search.
    const related = answer && (query.startsWith(answer.query) || answer.query.startsWith(query))
    return { status: 'loading', query, previous: related ? answer.results : null }
  }
  if (answer.results === null) return { status: 'error', query }
  return { status: 'done', query, results: answer.results }
}
