import { describe, expect, it } from 'vitest'
import { SITE_DESCRIPTION, SITE_IMAGE_ALT, SITE_NAME, SITE_TITLE } from '../src/shell/site.ts'
import { headersFor } from './security-headers.ts'
import { APP_PATHS, PUBLIC_PAGES, fillPage, noindexRules, robotsTxt, siteOrigin, sitemapXml } from './seo.ts'

describe('siteOrigin', () => {
  it('keeps only the origin of the address', () => {
    expect(siteOrigin('https://shumar.example/')).toBe('https://shumar.example')
    expect(siteOrigin('https://shumar.example')).toBe('https://shumar.example')
    expect(siteOrigin('http://localhost:4173')).toBe('http://localhost:4173')
    expect(siteOrigin('http://127.0.0.1:4173/')).toBe('http://127.0.0.1:4173')
  })

  it('refuses a missing address, a placeholder, plain http on the web, or a path', () => {
    expect(() => siteOrigin(undefined)).toThrow(/SITE_URL is needed/)
    expect(() => siteOrigin('your-site-address')).toThrow(/full address/)
    expect(() => siteOrigin('http://shumar.example')).toThrow(/https/)
    expect(() => siteOrigin('https://shumar.example/app')).toThrow(/no path/)
    expect(() => siteOrigin('https://shumar.example/?a=1')).toThrow(/no path/)
  })
})

describe('fillPage', () => {
  it('fills every site placeholder and leaves other text alone', () => {
    const html = '<title>%SITE_TITLE%</title><link href="%SITE_URL%/"><p>100%</p>'
    expect(fillPage(html, { SITE_TITLE: 'Shumār', SITE_URL: 'https://shumar.example' })).toBe(
      '<title>Shumār</title><link href="https://shumar.example/"><p>100%</p>',
    )
  })

  it('refuses a placeholder the build does not fill', () => {
    expect(() => fillPage('%SITE_SLOGAN%', {})).toThrow(/%SITE_SLOGAN%/)
  })

  it('refuses a value that would need escaping in HTML or JSON', () => {
    expect(() => fillPage('%SITE_TITLE%', { SITE_TITLE: 'Food & drink' })).toThrow(/escaping/)
    expect(() => fillPage('%SITE_TITLE%', { SITE_TITLE: 'Say "hi"' })).toThrow(/escaping/)
  })

  it("accepts Shumār's own words", () => {
    const values = { SITE_NAME, SITE_TITLE, SITE_DESCRIPTION, SITE_IMAGE_ALT }
    const html = Object.keys(values)
      .map((name) => `%${name}%`)
      .join('|')
    expect(fillPage(html, values)).toBe(Object.values(values).join('|'))
  })
})

describe('robots.txt and the sitemap', () => {
  it('lets every crawler in and points it at the sitemap', () => {
    expect(robotsTxt('https://shumar.example')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://shumar.example/sitemap.xml\n',
    )
  })

  it('lists only the public pages', () => {
    const xml = sitemapXml('https://shumar.example')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])).toEqual(['https://shumar.example/'])
  })
})

describe('noindexRules', () => {
  it('keeps the first-run questions and the signed-in screens out of search, but not the home page', () => {
    const rules = noindexRules()
    const robots = (paths: string[]) =>
      Object.fromEntries(paths.map((path) => [path, headersFor(path, rules)['X-Robots-Tag']]))
    const screens = ['/start/age', '/start/target', '/trends', '/you', '/log', '/log/edit/42', '/sources']
    expect(robots(screens)).toEqual(Object.fromEntries(screens.map((path) => [path, 'noindex'])))
    expect(robots(PUBLIC_PAGES)).toEqual(Object.fromEntries(PUBLIC_PAGES.map((path) => [path, undefined])))
  })

  it('never hides a public page', () => {
    expect(APP_PATHS.filter((path) => PUBLIC_PAGES.includes(path))).toEqual([])
  })
})
