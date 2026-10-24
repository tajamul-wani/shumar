// How Shumār introduces itself to search engines and link previews. The build fills the site's
// address and its own words into index.html, so canonical and share links point at the real site,
// and writes robots.txt and sitemap.xml. Only public pages belong in search results.
import type { HeaderRule } from './security-headers.ts'

/** Pages search engines may list. */
export const PUBLIC_PAGES = ['/']
/** The app's own screens, kept out of search results: the first-run questions and every signed-in screen. */
export const APP_PATHS = ['/start/*', '/trends', '/you', '/log', '/log/*', '/sources']

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

/** The site's own address, from SITE_URL: https for the live site, plain http only on this machine. */
export function siteOrigin(siteUrl: string | undefined): string {
  if (!siteUrl) {
    throw new Error(
      'SITE_URL is needed to build, because search and share links name the site. On this machine, use http://localhost:4173.',
    )
  }
  let url: URL
  try {
    url = new URL(siteUrl)
  } catch {
    throw new Error('SITE_URL must be a full address, such as https://shumar.example.')
  }
  if (url.protocol !== 'https:' && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('SITE_URL must use https.')
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL is the address of the site alone, with no path after it.')
  }
  return url.origin
}

/**
 * Fills each %SITE_...% in the page. The values may not hold characters that need escaping, so
 * each one reads the same in an HTML attribute, in text and in the page's JSON.
 */
export function fillPage(html: string, values: Record<string, string>): string {
  return html.replace(/%(SITE_[A-Z_]+)%/g, (placeholder, name: string) => {
    const value = values[name]
    if (value === undefined) throw new Error(`index.html uses ${placeholder}, which the build doesn't fill.`)
    if (/[&<>"\\]/.test(value)) throw new Error(`${name} has a character that would need escaping.`)
    return value
  })
}

export function robotsTxt(origin: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`
}

export function sitemapXml(origin: string): string {
  const urls = PUBLIC_PAGES.map((path) => `  <url><loc>${origin}${path}</loc></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

/** A noindex header on each of the app's own screens, for the _headers file. */
export function noindexRules(): HeaderRule[] {
  return APP_PATHS.map((path) => ({ path, headers: { 'X-Robots-Tag': 'noindex' } }))
}
