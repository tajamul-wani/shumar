import { expect, test, type Page } from '@playwright/test'
import {
  accessibilityViolations,
  apiClient,
  createTestUser,
  cspViolations,
  readTestUsers,
  scrollsSideways,
  signInAs,
  watchCsp,
} from './support.ts'

// A real USDA food from the imported data. The test reads its values back through search_foods
// rather than writing any nutrition number down here.
const EGG = 'Eggs, Grade A, Large, egg whole'
const EGG_UNIT = '1 egg, whole without shell'

interface FoundFood {
  name: string
  kcal_per_100g: number | string
  units: { name: string; grams: number | string }[]
}

async function openEgg(page: Page) {
  await page.getByRole('searchbox', { name: 'Search foods' }).fill('egg')
  await page
    .getByRole('list', { name: 'Search results' })
    .getByRole('button', { name: new RegExp(`^${EGG}`) })
    .first()
    .click()
  await expect(page.getByRole('heading', { level: 1, name: EGG })).toBeFocused()
}

test('a person finds a food, chooses an amount and adds it to a meal', async ({ page }) => {
  // A fresh user, so the devices running this test at the same time never see each other's logs.
  const user = await createTestUser('log')
  const api = apiClient(user.session.access_token)
  await watchCsp(page)
  await signInAs(page, user.session)
  await page.goto('/log')

  // Choose lunch, so the test doesn't depend on the time of day.
  await page.getByRole('button', { name: 'Change meal' }).click()
  await page.getByRole('group', { name: 'Meal' }).getByRole('button', { name: 'Lunch' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Add to lunch' })).toBeVisible()

  await openEgg(page)
  await expect(
    page.getByRole('group', { name: 'Unit' }).getByRole('button', { name: EGG_UNIT }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await expect(page.getByRole('textbox', { name: 'Quantity' })).toHaveValue('2')
  await page.getByRole('button', { name: 'Add to lunch' }).click()

  await expect(page.getByText(`Added 2 × ${EGG_UNIT} of ${EGG} to lunch.`)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Add to lunch' })).toBeFocused()
  await expect(page.getByRole('region', { name: 'Recent' })).toContainText(EGG)
  expect(await cspViolations(page)).toEqual([])

  const search = await api.rpc('search_foods', { query: 'egg', max_results: 20 })
  const egg = (search.data as FoundFood[]).find((food) => food.name === EGG)
  const portion = egg?.units.find((unit) => unit.name === EGG_UNIT)
  expect(egg && portion).toBeTruthy()
  const grams = 2 * Number(portion?.grams)
  const today = await page.evaluate(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  })

  const saved = await api
    .from('user_logs')
    .select('user_id, log_date, meal, food_name, food_source, quantity, unit_name, grams, kcal')
  try {
    expect(saved.error).toBeNull()
    expect(saved.data).toHaveLength(1)
    const [log] = saved.data ?? []
    expect(log).toMatchObject({
      user_id: user.session.user.id,
      log_date: today,
      meal: 'lunch',
      food_name: EGG,
      food_source: 'usda',
      quantity: 2,
      unit_name: EGG_UNIT,
    })
    expect(Number(log.grams)).toBeCloseTo(grams, 2)
    expect(Number(log.kcal)).toBeCloseTo((Number(egg?.kcal_per_100g) * grams) / 100, 2)
  } finally {
    await api.from('user_logs').delete().eq('user_id', user.session.user.id)
  }
})

test('a search made earlier today is answered on the device after a reload', async ({ page }) => {
  await signInAs(page, readTestUsers().a.session)
  let requests = 0
  page.on('request', (request) => {
    if (request.url().includes('/rpc/search_foods')) requests += 1
  })
  await page.goto('/log')
  const results = page.getByRole('list', { name: 'Search results' })

  await page.getByRole('searchbox', { name: 'Search foods' }).fill('egg')
  await expect(results).toContainText(EGG)
  expect(requests).toBe(1)

  await page.reload()
  await page.getByRole('searchbox', { name: 'Search foods' }).fill('egg')
  await expect(results).toContainText(EGG)
  expect(requests).toBe(1)
})

for (const theme of ['dark', 'light'] as const) {
  test(`every step of the log sheet passes accessibility checks and fits 320 px, ${theme} theme`, async ({
    page,
  }) => {
    await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
    await watchCsp(page)
    await signInAs(page, readTestUsers().a.session)
    await page.goto('/log')

    const check = async (step: string) => {
      const blocking = await accessibilityViolations(page)
      expect(blocking, `${step}: ${JSON.stringify(blocking, null, 2)}`).toEqual([])
      const size = page.viewportSize()
      await page.setViewportSize({ width: 320, height: 640 })
      expect(await scrollsSideways(page), `${step}: sideways scroll at 320 px`).toBe(false)
      if (size) await page.setViewportSize(size)
    }

    await page.getByRole('button', { name: 'Change meal' }).click()
    await expect(page.getByRole('group', { name: 'Meal' })).toBeVisible()
    await check('meal picker')

    await page.getByRole('searchbox', { name: 'Search foods' }).fill('egg')
    await expect(page.getByRole('list', { name: 'Search results' })).toBeVisible()
    await check('search results')

    await openEgg(page)
    await check('chosen food')
    expect(await cspViolations(page)).toEqual([])
  })
}
