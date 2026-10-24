import { expect, test } from '@playwright/test'

// What the page's head and the site's own files give browsers and phones. They are the same in
// every browser, so this runs once, on desktop.

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

test('serves the share image at 2400 x 1260', async ({ request }) => {
  const response = await request.get('/brand/share-image.png')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/^image\/png/)
  const png = await response.body()
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2400, 1260])
})
