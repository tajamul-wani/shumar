import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AppClient } from '../auth/context.ts'
import { getFoodSearch } from '../lib/foodSearch.ts'
import { useFoodSearch } from './useFoodSearch.ts'

// A made-up row for checking the hook, not nutrition data.
const cheese = {
  source: 'mine',
  source_id: 'm1',
  name: 'Test cheese',
  kcal_per_100g: 300,
  protein_per_100g: 20,
  carbs_per_100g: 2,
  fat_per_100g: 24,
  sodium_mg_per_100g: 20,
  flagged: false,
  verified: true,
  units: [],
}

/** Answers each search with the next list queued, or the last one again. */
function wrapperFor(answers: unknown[][]) {
  const rpc = vi.fn<() => unknown>(() => {
    const data = answers.length > 1 ? answers.shift() : answers[0]
    const response = Promise.resolve({ data, error: null })
    return Object.assign(response, { abortSignal: () => response })
  })
  const client = { auth: {}, rpc } as unknown as AppClient
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={{ client, session: null, loading: false }}>
        {children}
      </AuthContext.Provider>
    )
  }
  return { Wrapper, rpc, client }
}

afterEach(() => {
  localStorage.clear()
})

describe('useFoodSearch', () => {
  it('asks again in a new round, without showing the old answer meanwhile', async () => {
    const { Wrapper, rpc, client } = wrapperFor([[], [cheese]])
    const { result, rerender } = renderHook(({ round }) => useFoodSearch('kxtest cheese', 0, round), {
      wrapper: Wrapper,
      initialProps: { round: 0 },
    })
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'done', query: 'kxtest cheese', results: [] }),
    )

    // A food of their own was saved: the kept searches are forgotten (as useMyFoods does) and the
    // same words are searched again.
    getFoodSearch(client).forget()
    rerender({ round: 1 })
    expect(result.current).toEqual({ status: 'loading', query: 'kxtest cheese', previous: null })
    await waitFor(() => expect(result.current.status).toBe('done'))
    expect(result.current).toMatchObject({ results: [{ name: 'Test cheese', source: 'mine' }] })
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('keeps the list while someone types on in the same round', async () => {
    const { Wrapper } = wrapperFor([[cheese]])
    const { result, rerender } = renderHook(({ text }) => useFoodSearch(text, 0), {
      wrapper: Wrapper,
      initialProps: { text: 'kxtest' },
    })
    await waitFor(() => expect(result.current.status).toBe('done'))
    rerender({ text: 'kxtest c' })
    expect(result.current).toMatchObject({ status: 'loading', previous: [{ name: 'Test cheese' }] })
  })
})
