// The HTTP security headers every page is served with. The build writes them to
// dist/_headers for Cloudflare, and `vite preview` sends the same ones, so the
// end-to-end tests run under the real policy. Other rules, such as keeping the app's
// screens out of search results, go into the same file.

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

/** One rule in Cloudflare's _headers file: a path pattern and the headers it adds. */
export interface HeaderRule {
  path: string
  headers: Record<string, string>
}

/** Cloudflare's _headers format: each path pattern, then its indented `Name: value` lines. */
export function headersFile(rules: HeaderRule[]): string {
  const blocks = rules.map(({ path, headers }) =>
    [path, ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`)].join('\n'),
  )
  return `${blocks.join('\n')}\n`
}

/**
 * The headers Cloudflare sends for a path: those of every rule that matches it. A pattern ending
 * in /* matches everything below it, so /* matches every path.
 */
export function headersFor(pathname: string, rules: HeaderRule[]): Record<string, string> {
  const matches = (pattern: string) =>
    pattern.endsWith('/*') ? pathname.startsWith(pattern.slice(0, -1)) : pathname === pattern
  return Object.assign({}, ...rules.filter((rule) => matches(rule.path)).map((rule) => rule.headers))
}
