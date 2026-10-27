import { expect, test } from '@playwright/test'
import { SITE_DESCRIPTION, SITE_IMAGE_ALT, SITE_NAME, SITE_TITLE } from '../src/shell/site.ts'
import { MANIFEST_ICONS } from '../scripts/manifest.ts'
import { cspViolations, watchCsp } from './support.ts'

// What the page's head and the site's own files give browsers, phones, search engines and link
// previews. They are the same in every browser, so this runs once, on desktop.

const ICONS: [path: string, type: RegExp][] = [
  ['/favicon.ico', /^image\/(x-icon|vnd\.microsoft\.icon)/],
  ['/favicon-16.png', /^image\/png/],
  ['/favicon-32.png', /^image\/png/],
  ['/favicon-48.png', /^image\/png/],
  ['/apple-touch-icon.png', /^image\/png/],
  ['/brand/icon-192.png', /^image\/png/],
  ['/brand/icon-512.png', /^image\/png/],
  ['/brand/icon-maskable-512.png', /^image\/png/],
  ['/brand/logo-on-dark.svg', /^image\/svg\+xml/],
  ['/brand/logo-on-light.svg', /^image\/svg\+xml/],
]

test('links the favicon at each size and the iPhone icon', async ({ page }) => {
  await page.goto('/')
  const links = await page
    .locator('head link[rel="icon"], head link[rel="apple-touch-icon"]')
    .evaluateAll((elements) =>
      elements.map((el) => [el.getAttribute('rel'), el.getAttribute('href'), el.getAttribute('sizes')]),
    )
  expect(links).toEqual([
    ['icon', '/favicon-16.png', '16x16'],
    ['icon', '/favicon-32.png', '32x32'],
    ['icon', '/favicon-48.png', '48x48'],
    ['apple-touch-icon', '/apple-touch-icon.png', null],
  ])
})

test('serves every icon and logo file as the right kind of image', async ({ request }) => {
  for (const [path, type] of ICONS) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    expect(response.headers()['content-type'], path).toMatch(type)
  }
})

test.describe('what search engines and link previews read', () => {
  // Link previews and many crawlers read the page as sent, without running its code.
  test.use({ javaScriptEnabled: false })

  test("names Shumār, describes it, and points at the site's own address", async ({ page, baseURL }) => {
    await page.goto('/')
    const head = page.locator('head')
    const content = (selector: string) => head.locator(selector).getAttribute('content')
    const home = `${baseURL}/`

    expect(await page.title()).toBe(SITE_TITLE)
    expect(await content('meta[name="description"]')).toBe(SITE_DESCRIPTION)
    expect(await head.locator('link[rel="canonical"]').getAttribute('href')).toBe(home)
    expect(await content('meta[property="og:type"]')).toBe('website')
    expect(await content('meta[property="og:site_name"]')).toBe(SITE_NAME)
    expect(await content('meta[property="og:title"]')).toBe(SITE_TITLE)
    expect(await content('meta[property="og:description"]')).toBe(SITE_DESCRIPTION)
    expect(await content('meta[property="og:url"]')).toBe(home)
    expect(await content('meta[property="og:image"]')).toBe(`${baseURL}/brand/share-image.png`)
    expect(await content('meta[property="og:image:width"]')).toBe('2400')
    expect(await content('meta[property="og:image:height"]')).toBe('1260')
    expect(await content('meta[property="og:image:alt"]')).toBe(SITE_IMAGE_ALT)
    expect(await content('meta[name="twitter:card"]')).toBe('summary_large_image')
    expect(await page.content()).not.toMatch(/%SITE_[A-Z_]+%/)
  })

  test('describes the site and the app as structured data', async ({ page, baseURL }) => {
    await page.goto('/')
    const json = await page.locator('head script[type="application/ld+json"]').textContent()
    const graph = (JSON.parse(json ?? '{}') as { '@graph': Record<string, unknown>[] })['@graph']
    expect(graph).toEqual([
      { '@type': 'WebSite', name: SITE_NAME, alternateName: ['Shumar', 'شُمار'], url: `${baseURL}/` },
      {
        '@type': 'WebApplication',
        name: SITE_NAME,
        url: `${baseURL}/`,
        description: SITE_DESCRIPTION,
        applicationCategory: 'HealthApplication',
        operatingSystem: 'Any',
        inLanguage: 'en',
      },
    ])
  })
})

test('shows the full title in the tab, with nothing blocked by the security policy', async ({ page }) => {
  await watchCsp(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page).toHaveTitle(SITE_TITLE)
  expect(await cspViolations(page)).toEqual([])
})

test('serves the share image at 2400 x 1260', async ({ request }) => {
  const response = await request.get('/brand/share-image.png')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/^image\/png/)
  const png = await response.body()
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2400, 1260])
})

test('lets search engines find the home page through robots.txt and the sitemap', async ({
  request,
  baseURL,
}) => {
  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  expect(robots.headers()['content-type']).toMatch(/^text\/plain/)
  expect(await robots.text()).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${baseURL}/sitemap.xml\n`)

  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  expect(sitemap.headers()['content-type']).toMatch(/xml/)
  expect([...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])).toEqual([
    `${baseURL}/`,
    `${baseURL}/privacy`,
    `${baseURL}/sources`,
  ])
})

test("keeps the app's own screens out of search results", async ({ request }) => {
  for (const path of ['/', '/privacy', '/sources']) {
    expect((await request.get(path)).headers()['x-robots-tag'], path).toBeUndefined()
  }
  for (const path of [
    '/start/age',
    '/start/target',
    '/trends',
    '/trends/day/2026-10-24',
    '/you',
    '/log',
    '/log/edit/1',
  ]) {
    expect((await request.get(path)).headers()['x-robots-tag'], path).toBe('noindex')
  }
})

test('can be installed: the manifest is linked, served as a manifest, and names every icon it offers', async ({
  page,
  request,
}) => {
  await page.goto('/')
  const head = page.locator('head')
  expect(await head.locator('link[rel="manifest"]').getAttribute('href')).toBe('/manifest.webmanifest')
  expect(await head.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content')).toBe(
    SITE_NAME,
  )
  expect(await head.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content')).toBe('yes')
  expect(await head.locator('meta[name="mobile-web-app-capable"]').getAttribute('content')).toBe('yes')

  const response = await request.get('/manifest.webmanifest')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/^application\/manifest\+json/)
  const manifest = await response.json()
  expect(manifest).toMatchObject({
    name: SITE_NAME,
    start_url: '/',
    display: 'standalone',
    icons: MANIFEST_ICONS,
  })
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).status(), icon.src).toBe(200)
  }
})
