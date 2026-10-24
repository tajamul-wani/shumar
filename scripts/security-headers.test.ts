import { describe, expect, it } from 'vitest'
import {
  headersFile,
  headersFor,
  securityHeaders,
  supabaseOrigin,
  type HeaderRule,
} from './security-headers.ts'

const hosted = 'https://abcd1234.supabase.co'

function directives(csp: string): Map<string, string> {
  return new Map(
    csp.split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/)
      return [name, values.join(' ')]
    }),
  )
}

describe('supabaseOrigin', () => {
  it('keeps only the origin of the project address', () => {
    expect(supabaseOrigin(`${hosted}/rest/v1`)).toBe(hosted)
    expect(supabaseOrigin('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321')
  })

  it('refuses a missing address or plain http for a hosted project', () => {
    expect(() => supabaseOrigin(undefined)).toThrow(/VITE_SUPABASE_URL is needed/)
    expect(() => supabaseOrigin('http://abcd1234.supabase.co')).toThrow(/https/)
  })
})

describe('securityHeaders', () => {
  const headers = securityHeaders(hosted)
  const csp = directives(headers['Content-Security-Policy'])

  it('loads code, styles and fonts only from this site', () => {
    expect(csp.get('default-src')).toBe("'self'")
    expect(csp.get('script-src')).toBe("'self'")
    expect(csp.get('style-src')).toBe("'self'")
    expect(csp.get('font-src')).toBe("'self'")
    expect(headers['Content-Security-Policy']).not.toMatch(/unsafe-(inline|eval)/)
  })

  it('lets the app call only this site and its Supabase project', () => {
    expect(csp.get('connect-src')).toBe(`'self' ${hosted}`)
  })

  it('blocks plugins, framing and base or form hijacking', () => {
    expect(csp.get('object-src')).toBe("'none'")
    expect(csp.get('frame-ancestors')).toBe("'none'")
    expect(csp.get('base-uri')).toBe("'self'")
    expect(csp.get('form-action')).toBe("'self'")
    expect(headers['X-Frame-Options']).toBe('DENY')
  })

  it('sets the transport, sniffing, referrer and device permission headers', () => {
    expect(headers['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()')
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin')
  })
})

const rules: HeaderRule[] = [
  { path: '/*', headers: { 'X-One': '1', 'X-Two': '2' } },
  { path: '/you', headers: { 'X-Robots-Tag': 'noindex' } },
  { path: '/start/*', headers: { 'X-Robots-Tag': 'noindex' } },
]

describe('headersFile', () => {
  it('writes each rule as its path followed by its headers', () => {
    expect(headersFile(rules.slice(0, 2))).toBe('/*\n  X-One: 1\n  X-Two: 2\n/you\n  X-Robots-Tag: noindex\n')
  })
})

describe('headersFor', () => {
  it('sends the headers of every rule that matches, as Cloudflare does', () => {
    expect(headersFor('/', rules)).toEqual({ 'X-One': '1', 'X-Two': '2' })
    expect(headersFor('/you', rules)).toEqual({ 'X-One': '1', 'X-Two': '2', 'X-Robots-Tag': 'noindex' })
    expect(headersFor('/start/age', rules)['X-Robots-Tag']).toBe('noindex')
  })

  it('matches a path exactly, and a pattern ending in /* only below it', () => {
    expect(headersFor('/your-data', rules)['X-Robots-Tag']).toBeUndefined()
    expect(headersFor('/start', rules)['X-Robots-Tag']).toBeUndefined()
  })
})
