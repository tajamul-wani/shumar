import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The app only ever talks to Supabase with the public project address and the
 * publishable key. Both end up in the browser bundle by design: row-level security
 * is what protects the data. A secret key must never get here, so this refuses to
 * start if one is configured by mistake.
 */

interface SupabaseConfig {
  url: string
  key: string
}

export class SupabaseConfigError extends Error {}

function looksSecret(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  // Legacy keys are JWTs. Only the anon one is public; any other role, or a token
  // we can't read, is treated as secret.
  const parts = key.split('.')
  if (parts.length === 1) return false
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return (JSON.parse(json) as { role?: string }).role !== 'anon'
  } catch {
    return true
  }
}

export function readSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim() ?? ''
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  if (!url || !key) {
    throw new SupabaseConfigError(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.',
    )
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new SupabaseConfigError('VITE_SUPABASE_URL is not a valid address.')
  }
  const isLocal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
  if (!isLocal && parsed.protocol !== 'https:') {
    throw new SupabaseConfigError('VITE_SUPABASE_URL must use https.')
  }
  if (looksSecret(key)) {
    throw new SupabaseConfigError(
      'A secret Supabase key is configured. Use the publishable key: secret keys bypass row-level security.',
    )
  }
  return { url, key }
}

export function createSupabase(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.key, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
