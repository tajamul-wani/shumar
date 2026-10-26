import { expect, test } from '@playwright/test'
import {
  accessibilityViolations,
  apiClient,
  createTestUser,
  cspViolations,
  saveTestProfile,
  scrollsSideways,
  signInAs,
  watchCsp,
} from './support.ts'

/** Today on this machine, which the browser shares, as YYYY-MM-DD. */
function todayKey(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Placeholder logs with easy numbers: they only exercise the screen and are not nutrition data.
function placeholder(meal: string, foodName: string, hour: number, kcal: number, sodiumMg: number) {
  const now = new Date()
  return {
    log_date: todayKey(),
    logged_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour).toISOString(),
    meal,
    food_name: foodName,
    food_source: 'usda',
    quantity: 1,
    unit_name: 'g',
    grams: 100,
    kcal,
    protein: 10,
    carbs: 20,
    fat: 5,
    sodium_mg: sodiumMg,
  }
}

for (const theme of ['dark', 'light'] as const) {
  test(`Today shows the day's calories, macros, sodium alert and meals, ${theme} theme`, async ({ page }) => {
    // A fresh user, so devices running this at the same time never see each other's logs.
    const user = await createTestUser('today')
    const api = apiClient(user.session.access_token)
    const inserted = await api
      .from('user_logs')
      .insert([
        placeholder('breakfast', 'Test tea', 8, 100, 1500),
        placeholder('breakfast', 'Test bread', 8, 200, 300),
        placeholder('dinner', 'Test rice', 20, 300, 400),
      ])
    expect(inserted.error).toBeNull()

    try {
      await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
      await watchCsp(page)
      await signInAs(page, user.session)
      await page.goto('/')

      const ring = page.getByRole('region', { name: 'Calories and macros' })
      await expect(ring).toContainText('600kcal eaten')
      await expect(ring).toContainText('Protein30 g')
      await expect(page.getByRole('region', { name: /review$/ })).toContainText(
        'Sodium is high, mostly from Test tea',
      )
      const meals = page.getByRole('region', { name: 'Meals' })
      await expect(meals.getByRole('article')).toHaveCount(2)
      const breakfast = meals.getByRole('article', { name: 'Breakfast' })
      await expect(breakfast).toContainText('300 kcal50% of today')
      await expect(breakfast).toContainText('Protein 20 g Carbs 40 g Fat 10 g')
      await expect(breakfast.getByRole('listitem')).toHaveCount(2)
      await expect(meals.getByRole('article', { name: 'Dinner' })).toContainText(
        'Protein 10 g Carbs 20 g Fat 5 g',
      )
      await expect(page.getByText('1 day logged')).toBeVisible()

      const blocking = await accessibilityViolations(page)
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
      await page.setViewportSize({ width: 320, height: 640 })
      expect(await scrollsSideways(page)).toBe(false)
      expect(await cspViolations(page)).toEqual([])
    } finally {
      await api.from('user_logs').delete().eq('user_id', user.session.user.id)
    }
  })
}

test('a food is removed from Today, put back with Undo, and changed', async ({ page }) => {
  const user = await createTestUser('remove')
  const api = apiClient(user.session.access_token)
  const inserted = await api.from('user_logs').insert([
    // One cup of 100 g, so Increase adds half a cup.
    { ...placeholder('breakfast', 'Test tea', 8, 100, 0), unit_name: 'cup' },
    placeholder('breakfast', 'Test bread', 8, 200, 0),
  ])
  expect(inserted.error).toBeNull()
  const names = async () => (await api.from('user_logs').select('food_name').order('food_name')).data

  try {
    await watchCsp(page)
    await signInAs(page, user.session)
    await page.goto('/')
    const meals = page.getByRole('region', { name: 'Meals' })
    const ring = page.getByRole('region', { name: 'Calories and macros' })
    await expect(meals.getByRole('article', { name: 'Breakfast' })).toContainText('Test bread')
    const blocking = await accessibilityViolations(page)
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
    const size = page.viewportSize()
    await page.setViewportSize({ width: 320, height: 640 })
    expect(await scrollsSideways(page)).toBe(false)
    if (size) await page.setViewportSize(size)

    await meals.getByRole('button', { name: 'Remove Test bread' }).click()
    await expect(page.getByRole('status').filter({ hasText: /^Removed/ })).toBeVisible()
    await expect(ring).toContainText('100kcal eaten')
    await expect(page.getByRole('button', { name: 'Undo' })).toBeFocused()
    // The toast with Undo passes the accessibility checks and fits a 320 px screen too.
    const withToast = await accessibilityViolations(page)
    expect(withToast, JSON.stringify(withToast, null, 2)).toEqual([])
    const wide = page.viewportSize()
    await page.setViewportSize({ width: 320, height: 640 })
    expect(await scrollsSideways(page)).toBe(false)
    if (wide) await page.setViewportSize(wide)
    await expect.poll(names).toEqual([{ food_name: 'Test tea' }])

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByRole('status').filter({ hasText: /^Put back/ })).toBeVisible()
    await expect(ring).toContainText('300kcal eaten')
    await expect.poll(names).toEqual([{ food_name: 'Test bread' }, { food_name: 'Test tea' }])

    await meals.getByRole('link', { name: 'Edit Test tea' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Test tea' })).toBeFocused()
    await page.getByRole('button', { name: 'Increase quantity' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL('/')
    await expect(ring).toContainText('350kcal eaten')
    expect(await cspViolations(page)).toEqual([])
  } finally {
    await api.from('user_logs').delete().eq('user_id', user.session.user.id)
  }
})

test('on a wide screen, a food added beside Today shows in the day at once', async ({ page }) => {
  const user = await createTestUser('desktop')
  const api = apiClient(user.session.access_token)
  try {
    await watchCsp(page)
    await signInAs(page, user.session)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const ring = page.getByRole('region', { name: 'Calories and macros' })
    await expect(ring).toContainText('0kcal eaten')
    await expect(page.getByRole('link', { name: 'Log food' })).toBeHidden()

    await expect(page.getByRole('heading', { level: 2, name: 'Add food' })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search foods' }).fill('egg')
    await page
      .getByRole('list', { name: 'Search results' })
      .getByRole('button', { name: /^Eggs, Grade A, Large, egg whole/ })
      .click()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Eggs, Grade A, Large, egg whole' }),
    ).toBeFocused()
    await page.getByRole('button', { name: /^Add to / }).click()

    await expect(page.getByRole('heading', { level: 2, name: 'Add food' })).toBeFocused()
    await expect(ring).not.toContainText('0kcal eaten')
    const meals = page.getByRole('region', { name: 'Meals' })
    const meal = meals.getByRole('article')
    // The meal's time shows, and its foods are listed without a tap.
    await expect(meal).toContainText(/\d{1,2}:\d{2}/)
    await expect(meals.getByRole('link', { name: 'Edit Eggs, Grade A, Large, egg whole' })).toBeVisible()
    await expect(page.getByText('1 day logged')).toBeVisible()

    // The meals and Add food share a row, with Add food to the right, and the calories sit above them.
    const addFood = page.getByRole('heading', { level: 2, name: 'Add food' })
    const [ringBox, mealsBox, addBox] = await Promise.all([
      ring.boundingBox(),
      meals.boundingBox(),
      addFood.boundingBox(),
    ])
    expect(addBox!.x).toBeGreaterThan(mealsBox!.x + mealsBox!.width)
    expect(Math.abs(addBox!.y - mealsBox!.y)).toBeLessThan(40)
    expect(ringBox!.y + ringBox!.height).toBeLessThanOrEqual(mealsBox!.y)

    const blocking = await accessibilityViolations(page)
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
    // Where Add food and the day no longer fit side by side, they stack without sideways scroll.
    await page.setViewportSize({ width: 1024, height: 768 })
    expect(await scrollsSideways(page)).toBe(false)
    expect(await cspViolations(page)).toEqual([])
  } finally {
    await api.from('user_logs').delete().eq('user_id', user.session.user.id)
  }
})

test('the same food in the same amount shows once with its count, and Remove takes one away', async ({
  page,
}) => {
  const user = await createTestUser('group')
  const api = apiClient(user.session.access_token)
  // Three of the same 40 g placeholder, logged one after another.
  const egg = (minute: number) => ({
    ...placeholder('breakfast', 'Test egg', 8, 59, 50),
    logged_at: new Date(new Date().setHours(8, minute, 0, 0)).toISOString(),
    quantity: 40,
    grams: 40,
  })
  const inserted = await api.from('user_logs').insert([egg(1), egg(2), egg(3)])
  expect(inserted.error).toBeNull()

  try {
    await signInAs(page, user.session)
    await page.goto('/')
    const meals = page.getByRole('region', { name: 'Meals' })
    const breakfast = meals.getByRole('article', { name: 'Breakfast' })
    await expect(breakfast).toContainText('177 kcal')

    const row = meals.getByRole('listitem').filter({ hasText: 'Test egg' }).last()
    await expect(row).toContainText('×3')
    await expect(row).toContainText('40 g each 177 kcal')

    await row.getByRole('button', { name: 'Remove one Test egg' }).click()
    await expect(row).toContainText('×2')
    await expect(row).toContainText('40 g each 118 kcal')
    await expect
      .poll(async () => (await api.from('user_logs').select('id', { count: 'exact', head: true })).count)
      .toBe(2)
  } finally {
    await api.from('user_logs').delete().eq('user_id', user.session.user.id)
  }
})

test('with a daily target, Today shows the calories left, the macro targets and the review', async ({
  page,
}) => {
  const user = await createTestUser('today-target')
  const api = apiClient(user.session.access_token)
  await saveTestProfile(user.session.access_token)
  const logs = await api
    .from('user_logs')
    .insert([
      placeholder('breakfast', 'Test tea', 8, 100, 1500),
      placeholder('breakfast', 'Test bread', 8, 200, 300),
      placeholder('dinner', 'Test rice', 20, 300, 400),
    ])
  expect(logs.error).toBeNull()

  await watchCsp(page)
  await signInAs(page, user.session)
  await page.goto('/')

  const ring = page.getByRole('region', { name: 'Calories and macros' })
  await expect(ring).toContainText('1,576kcal left')
  await expect(ring).toContainText('600 eaten of 2,176 kcal')
  await expect(ring).toContainText('Protein30128 g')
  const review = page.getByRole('region', { name: /review$/ })
  await expect(review).toContainText('A steady day. You have 1,576 kcal left.')
  await expect(review).toContainText('Carbs are furthest behind60 of 280 g')
  await expect(review).toContainText('Sodium is high, mostly from Test tea')
  // On a wide screen the review sits beside the calories, in the same row.
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    const [ringBox, reviewBox] = await Promise.all([ring.boundingBox(), review.boundingBox()])
    expect(Math.abs(ringBox!.y - reviewBox!.y)).toBeLessThan(2)
    expect(reviewBox!.x).toBeGreaterThan(ringBox!.x + ringBox!.width)
  }
  expect(await accessibilityViolations(page)).toEqual([])
  expect(await scrollsSideways(page)).toBe(false)
  expect(await cspViolations(page)).toEqual([])
})
