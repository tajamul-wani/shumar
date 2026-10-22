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
  await page.getByRole('button', { name: /, change meal$/ }).click()
  await page.getByRole('group', { name: 'Meal' }).getByRole('button', { name: 'Lunch' }).click()
  await expect(page.getByRole('button', { name: 'To lunch, change meal' })).toBeVisible()

  await openEgg(page)
  await expect(
    page.getByRole('group', { name: 'Unit' }).getByRole('button', { name: EGG_UNIT }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await expect(page.getByRole('textbox', { name: 'Quantity' })).toHaveValue('2')
  await page.getByRole('button', { name: 'Add to lunch' }).click()

  await expect(page.getByRole('status').filter({ hasText: /^Added to lunch/ })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Add food' })).toBeFocused()
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

test('a person changes the amount and meal of a logged food', async ({ page }) => {
  const user = await createTestUser('edit')
  const api = apiClient(user.session.access_token)
  // A placeholder log with easy numbers: it only exercises the screen and is not nutrition data.
  const created = await api
    .from('user_logs')
    .insert({
      meal: 'breakfast',
      food_name: 'Test tea',
      food_source: 'kashmiri',
      quantity: 1,
      unit_name: 'cup',
      grams: 150,
      kcal: 45,
      protein: 1.5,
      carbs: 4.5,
      fat: 2.25,
      sodium_mg: 300,
    })
    .select('id')
    .single()
  expect(created.error).toBeNull()
  const id = created.data?.id as string

  await watchCsp(page)
  await signInAs(page, user.session)
  await page.goto(`/log/edit/${id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Test tea' })).toBeFocused()
  const blocking = await accessibilityViolations(page)
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
  const size = page.viewportSize()
  await page.setViewportSize({ width: 320, height: 640 })
  expect(await scrollsSideways(page)).toBe(false)
  if (size) await page.setViewportSize(size)

  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await page.getByRole('group', { name: 'Meal' }).getByRole('button', { name: 'Dinner' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL('/')
  expect(await cspViolations(page)).toEqual([])

  const saved = await api
    .from('user_logs')
    .select('meal, quantity, grams, kcal, sodium_mg')
    .eq('id', id)
    .single()
  try {
    expect(saved.data).toEqual({ meal: 'dinner', quantity: 2, grams: 300, kcal: 90, sodium_mg: 600 })
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

test('the log sheet header stays on one line on a 320 px phone, even for evening tea', async ({ page }) => {
  await signInAs(page, readTestUsers().a.session)
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/log')
  await page.getByRole('button', { name: /, change meal$/ }).click()
  await page.getByRole('group', { name: 'Meal' }).getByRole('button', { name: 'Evening tea' }).click()

  const heading = await page.getByRole('heading', { level: 1, name: 'Add food' }).boundingBox()
  const meal = await page.getByRole('button', { name: 'To evening tea, change meal' }).boundingBox()
  if (!heading || !meal) throw new Error('The header is not on the screen')
  // One line each: the heading no taller than its 28 px line, the button no taller than its 44 px.
  expect(heading.height).toBeLessThanOrEqual(28)
  expect(meal.height).toBeLessThanOrEqual(44)
  // And side by side, level with each other.
  expect(Math.abs(heading.y + heading.height / 2 - (meal.y + meal.height / 2))).toBeLessThan(4)
  expect(await scrollsSideways(page)).toBe(false)
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

    await page.getByRole('button', { name: /, change meal$/ }).click()
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
