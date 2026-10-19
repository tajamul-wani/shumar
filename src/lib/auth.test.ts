import { describe, expect, it, vi } from 'vitest'
import { USER_CACHE_PREFIX, clearUserData, signInWithGoogle, signOut } from './auth.ts'
import { THEME_STORAGE_KEY } from './theme.ts'

function memoryStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries))
  return {
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (key: string) => void map.delete(key),
    keys: () => [...map.keys()].sort(),
  }
}

function fakeClient(overrides: { oauthError?: Error; signOutError?: Error } = {}) {
  return {
    auth: {
      signInWithOAuth: vi
        .fn<() => Promise<unknown>>()
        .mockResolvedValue({ data: {}, error: overrides.oauthError ?? null }),
      signOut: overrides.signOutError
        ? vi.fn<() => Promise<unknown>>().mockRejectedValue(overrides.signOutError)
        : vi.fn<() => Promise<unknown>>().mockResolvedValue({ error: null }),
    },
  } as unknown as Parameters<typeof signOut>[0]
}

describe('signInWithGoogle', () => {
  it('asks Supabase for Google and returns the user to this app', async () => {
    const client = fakeClient()
    await signInWithGoogle(client, 'https://shumar.example')
    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://shumar.example' },
    })
  })

  it('passes on an error from Supabase', async () => {
    await expect(signInWithGoogle(fakeClient({ oauthError: new Error('offline') }), 'x')).rejects.toThrow(
      'offline',
    )
  })
})

describe('clearUserData', () => {
  it('removes the session and cached user data but keeps the theme', () => {
    const storage = memoryStorage({
      'sb-127-auth-token': 'session',
      [`${USER_CACHE_PREFIX}logs`]: '[]',
      [THEME_STORAGE_KEY]: 'dark',
      unrelated: 'keep',
    })
    clearUserData(storage)
    expect(storage.keys()).toEqual([THEME_STORAGE_KEY, 'unrelated'].sort())
  })

  it('does nothing when there is no storage', () => {
    expect(() => clearUserData(undefined)).not.toThrow()
  })
})

describe('signOut', () => {
  it('signs out and clears the device', async () => {
    const client = fakeClient()
    const storage = memoryStorage({ 'sb-127-auth-token': 'session' })
    await signOut(client, storage)
    expect(client.auth.signOut).toHaveBeenCalled()
    expect(storage.keys()).toEqual([])
  })

  it('still clears the device when the network call fails', async () => {
    const storage = memoryStorage({ 'sb-127-auth-token': 'session' })
    await expect(signOut(fakeClient({ signOutError: new Error('offline') }), storage)).rejects.toThrow(
      'offline',
    )
    expect(storage.keys()).toEqual([])
  })
})
