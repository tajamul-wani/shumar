import type { SupabaseClient } from '@supabase/supabase-js'
import { deviceStorage } from './deviceStorage.ts'
import { THEME_STORAGE_KEY } from './theme.ts'

/** Anything the app caches about a user starts with this prefix, so sign-out can clear it. */
export const USER_CACHE_PREFIX = 'shumar-cache:'

type AuthClient = Pick<SupabaseClient, 'auth'>
type ClearableStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>

/** Sends the user to Google, then back to this app. */
export async function signInWithGoogle(client: AuthClient, origin: string = window.location.origin) {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: origin },
  })
  if (error) throw error
}

/**
 * Removes everything stored about the signed-in user from this device: their session
 * and any cached data. The theme choice stays, because it's a device setting, not
 * personal data. On a shared phone, the next person sees nothing of the last one.
 */
export function clearUserData(storage: ClearableStorage | undefined = deviceStorage()): void {
  if (!storage) return
  const keys: string[] = []
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (key && key !== THEME_STORAGE_KEY && (key.startsWith(USER_CACHE_PREFIX) || key.startsWith('sb-'))) {
      keys.push(key)
    }
  }
  keys.forEach((key) => storage.removeItem(key))
}

export async function signOut(client: AuthClient, storage?: ClearableStorage): Promise<void> {
  try {
    await client.auth.signOut()
  } finally {
    // Clear the device even if the network call fails.
    clearUserData(storage)
  }
}
