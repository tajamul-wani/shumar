import { describe, expect, it } from 'vitest'
import { findSecrets } from './bundle-secrets.ts'

// Fake secrets are assembled at run time so this file never holds anything that
// looks like a real key to the commit guard or the history scan.
const filler = 'a'.repeat(32)
const fake = (prefix: string) => `${prefix}${filler}`
const dashes = '-----'

function jwt(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

describe('findSecrets', () => {
  it('passes ordinary app code and a publishable key', () => {
    expect(findSecrets(`const key = "sb_publishable_${filler}"; fetch("/rest/v1")`)).toEqual([])
  })

  it('passes a legacy anon key, which is public by design', () => {
    expect(findSecrets(`const key = "${jwt({ role: 'anon' })}"`)).toEqual([])
  })

  it('finds each kind of secret without repeating it', () => {
    const cases: [string, string][] = [
      [fake('sb_secret_'), 'Supabase secret key'],
      [fake('lin_api_'), 'Linear API key'],
      [fake('GOCSPX-'), 'Google client secret'],
      [`${dashes}BEGIN RSA PRIVATE KEY${dashes}`, 'private key'],
      [jwt({ role: 'authenticated' }), 'Supabase key with elevated access'],
      [jwt({ sub: 'no-role' }), 'Supabase key with elevated access'],
    ]
    for (const [secret, name] of cases) {
      const found = findSecrets(`var x="${secret}"`)
      expect(found).toEqual([name])
      expect(found.join(' ')).not.toContain(secret)
    }
  })

  it('treats a token whose payload is not readable JSON as elevated', () => {
    const broken = `${jwt({}).split('.')[0]}.${Buffer.from('{"role').toString('base64url')}.sig`
    expect(findSecrets(broken)).toEqual(['Supabase key with elevated access'])
  })

  it('reports each kind once', () => {
    const key = fake('sb_secret_')
    const token = jwt({ role: 'authenticated' })
    expect(findSecrets(`${key} ${key} ${token} ${token}`)).toEqual([
      'Supabase secret key',
      'Supabase key with elevated access',
    ])
  })
})
