import { describe, expect, it } from 'vitest'
import { SupabaseConfigError, createSupabase, readSupabaseConfig } from './supabase.ts'

function jwt(payload: object): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

const hosted = 'https://abcd1234.supabase.co'

describe('readSupabaseConfig', () => {
  it('accepts a hosted https address with a publishable key', () => {
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: hosted, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' }),
    ).toEqual({ url: hosted, key: 'sb_publishable_abc' })
  })

  it('trims stray spaces', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: ` ${hosted} `,
        VITE_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_abc ',
      }),
    ).toEqual({ url: hosted, key: 'sb_publishable_abc' })
  })

  it('allows plain http only for the local stack', () => {
    for (const url of ['http://127.0.0.1:54321', 'http://localhost:54321']) {
      expect(
        readSupabaseConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' })
          .url,
      ).toBe(url)
    }
  })

  it('refuses missing values', () => {
    expect(() => readSupabaseConfig({})).toThrow(SupabaseConfigError)
    expect(() => readSupabaseConfig({ VITE_SUPABASE_URL: hosted })).toThrow(/not configured/)
    expect(() => readSupabaseConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' })).toThrow(
      /not configured/,
    )
  })

  it('refuses an address that is not a URL', () => {
    expect(() =>
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'not a url',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc',
      }),
    ).toThrow(/not a valid address/)
  })

  it('refuses plain http for a hosted project', () => {
    expect(() =>
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'http://abcd1234.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc',
      }),
    ).toThrow(/https/)
  })

  it('refuses a secret key', () => {
    expect(() =>
      readSupabaseConfig({ VITE_SUPABASE_URL: hosted, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' }),
    ).toThrow(/secret Supabase key/)
  })

  it('accepts a legacy anon key and refuses a legacy key with any other role', () => {
    const anon = jwt({ role: 'anon' })
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: hosted, VITE_SUPABASE_PUBLISHABLE_KEY: anon }).key).toBe(
      anon,
    )
    for (const role of ['authenticated', 'supabase_admin', undefined]) {
      expect(() =>
        readSupabaseConfig({ VITE_SUPABASE_URL: hosted, VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ role }) }),
      ).toThrow(/secret Supabase key/)
    }
  })

  it('refuses a dotted key it cannot read', () => {
    expect(() =>
      readSupabaseConfig({ VITE_SUPABASE_URL: hosted, VITE_SUPABASE_PUBLISHABLE_KEY: 'a.%%%.c' }),
    ).toThrow(/secret Supabase key/)
  })
})

describe('createSupabase', () => {
  it('builds a client with an auth API', () => {
    const client = createSupabase({ url: hosted, key: 'sb_publishable_abc' })
    expect(typeof client.auth.signInWithOAuth).toBe('function')
  })
})
