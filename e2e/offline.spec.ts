import { expect, test, type Page } from '@playwright/test'
import { createTestUser, cspViolations, signInAs, supabaseUrl, watchCsp } from './support.ts'

// The service worker keeps the app's own files, so it opens without a connection, and never keeps
// anything from Supabase. It runs on every device: iPhones and Android phones are where people install it.

/** Waits until the page is under the service worker, as it is from the second visit on. */
async function underWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (navigator.serviceWorker.controller) return
    await new Promise((resolve) =>
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
    )
  })
}

/** Every address the page's caches hold. */
function keptAddresses(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) urls.push(request.url)
    }
    return urls
  })
}

test('opens without a connection, signed out, and keeps only its own files', async ({
  page,
  context,
  baseURL,
}) => {
  await watchCsp(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await underWorker(page)

  const kept = await keptAddresses(page)
  expect(kept).toContain(`${baseURL}/`)
  expect(kept).toContain(`${baseURL}/manifest.webmanifest`)
  expect(kept.filter((url) => !url.startsWith(`${baseURL}/`))).toEqual([])

  await context.setOffline(true)
  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Your daily tally, built for Kashmiri food.' }),
  ).toBeVisible()
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible()
  await context.setOffline(false)
  expect(await cspViolations(page)).toEqual([])
})

test("opens without a connection, signed in, on Today with a message, and keeps no one's data", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await createTestUser('offline')
  await watchCsp(page)
  await signInAs(page, user.session)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await underWorker(page)
  // A reload under the worker reads the day again through it.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  // supabase-js tries a failed read a few more times before giving up.
  await expect(page.getByRole('alert').first()).toContainText('Check your connection', { timeout: 15_000 })
  await context.setOffline(false)

  const kept = await keptAddresses(page)
  expect(kept.filter((url) => !url.startsWith(`${baseURL}/`))).toEqual([])
  expect(kept.filter((url) => url.startsWith(supabaseUrl()) || /\/(rest|auth)\/v1\//.test(url))).toEqual([])
  expect(await cspViolations(page)).toEqual([])
})

test('serves the worker fresh every time, under the same security policy', async ({ request }) => {
  const response = await request.get('/sw.js')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/javascript/)
  expect(response.headers()['cache-control']).toBe('no-cache')
  expect(response.headers()['content-security-policy']).toContain("default-src 'self'")
})
