import type { User } from '@supabase/supabase-js'

export type AccountUser = Pick<User, 'email' | 'user_metadata' | 'app_metadata'>

interface AccountSummary {
  /** The person's name from Google, or their email when there is no name. */
  name: string
  /** A second line under the name, or null when it would only repeat it. */
  detail: string | null
  /** The first letter of the name, for the round avatar. */
  initial: string
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

export function summarizeAccount(user: AccountUser): AccountSummary {
  const metadata = user.user_metadata ?? {}
  const fullName = firstText(metadata.full_name, metadata.name)
  const email = firstText(user.email)
  const name = fullName ?? email ?? 'Your account'
  const viaGoogle = user.app_metadata?.provider === 'google'
  const detail = viaGoogle ? 'Signed in with Google' : fullName && email ? email : null
  // Array.from splits by character, not UTF-16 unit, so a name starting with any script works.
  const initial = (Array.from(name)[0] ?? '?').toUpperCase()
  return { name, detail, initial }
}
