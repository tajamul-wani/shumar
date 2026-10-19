// The HTTP security headers every page is served with. The build writes them to
// dist/_headers for Cloudflare, and `vite preview` sends the same ones, so the
// end-to-end tests run under the real policy.

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

/** The origin the app may call: the Supabase project, and nothing else outside this site. */
export function supabaseOrigin(supabaseUrl: string | undefined): string {
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is needed to build, because the security policy names it.')
  }
  const url = new URL(supabaseUrl)
  if (url.protocol !== 'https:' && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('VITE_SUPABASE_URL must use https.')
  }
  return url.origin
}

export function securityHeaders(supabaseUrl: string | undefined): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseOrigin(supabaseUrl)}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  return {
    'Content-Security-Policy': csp,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  }
}

/** Cloudflare's _headers format: a path pattern, then indented `Name: value` lines. */
export function headersFile(headers: Record<string, string>): string {
  const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`)
  return `/*\n${lines.join('\n')}\n`
}
