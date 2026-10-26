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

test('the Add food popup: pick a meal, search, add, name a meal of your own, and Done', async ({ page }) => {
  const user = await createTestUser('popup')
  const api = apiClient(user.session.access_token)
  try {
    await watchCsp(page)
    await signInAs(page, user.session)
    await page.goto('/')
    const ring = page.getByRole('region', { name: 'Calories and macros' })
    await expect(ring).toContainText('0kcal eaten')
    const meals = page.getByRole('region', { name: 'Meals' })
    await expect(meals).toContainText('No meals yet today.')
    // The phone's round plus and the wide screen's header button open the same popup.
    const wide = (page.viewportSize()?.width ?? 0) >= 1024
    await page
      .getByRole('button', { name: 'Add food' })
      .nth(wide ? 0 : 1)
      .click()
    const popup = page.getByRole('dialog', { name: 'Add food' })
    await expect(popup).toBeVisible()
    await expect(popup.getByRole('searchbox', { name: 'Search foods' })).toBeFocused()
    await popup.getByRole('button', { name: 'Lunch' }).click()
    await expect(popup.getByRole('button', { name: 'Lunch' })).toHaveAttribute('aria-pressed', 'true')

    // One food through its unit and amount, then one from the plus on its row, which opens it first:
    // nothing goes in until "Add to lunch".
    await popup.getByRole('searchbox', { name: 'Search foods' }).fill('egg')
    const results = popup.getByRole('list', { name: 'Search results' })
    await results.getByRole('button', { name: /^Eggs, Grade A, Large, egg whole/ }).click()
    await expect(
      popup.getByRole('heading', { level: 2, name: 'Eggs, Grade A, Large, egg whole' }),
    ).toBeFocused()
    await popup.getByRole('button', { name: 'Add to lunch' }).click()
    await expect(popup.getByRole('searchbox', { name: 'Search foods' })).toBeFocused()
    const inMeal = popup.getByRole('region', { name: /^In lunch now/ })
    await expect(inMeal).toContainText('Eggs, Grade A, Large, egg whole')
    await popup.getByRole('searchbox', { name: 'Search foods' }).fill('egg')
    await results
      .getByRole('button', { name: /^Add .*Egg, whole, raw, fresh/ })
      .first()
      .click()
    await expect(inMeal.getByRole('listitem')).toHaveCount(1)
    await popup.getByRole('button', { name: 'Add to lunch' }).click()
    await expect(inMeal.getByRole('listitem')).toHaveCount(2)
    // The search clears for the next food.
    await expect(popup.getByRole('searchbox', { name: 'Search foods' })).toHaveValue('')
    // The day behind the popup already shows both.
    await expect(ring).not.toContainText('0kcal eaten')
    await expect(meals.getByRole('article', { name: 'Lunch' }).getByRole('listitem')).toHaveCount(2)

    // A meal of the person's own.
    await popup.getByRole('textbox', { name: 'Or name a meal' }).fill('Chai')
    await popup.getByRole('textbox', { name: 'Or name a meal' }).press('Enter')
    await expect(popup.getByRole('button', { name: 'Chai' })).toHaveAttribute('aria-pressed', 'true')
    await popup.getByRole('searchbox', { name: 'Search foods' }).fill('tea')
    await results
      .getByRole('button', { name: /^Add .*tea/i })
      .first()
      .click()
    await popup.getByRole('button', { name: 'Add to Chai' }).click()
    await expect(popup.getByRole('region', { name: /^In Chai now/ })).toBeVisible()
    await expect(meals.getByRole('article', { name: 'Chai' })).toBeVisible()

    const blocking = await accessibilityViolations(page)
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
    await popup.getByRole('button', { name: 'Done' }).click()
    await expect(popup).toBeHidden()
    await expect(meals.getByRole('article')).toHaveCount(2)
    await expect(meals.getByRole('article', { name: 'Lunch' })).toContainText(/\d{1,2}:\d{2}/)
    await expect(page.getByText('1 day logged')).toBeVisible()
    expect(await scrollsSideways(page)).toBe(false)
    expect(await cspViolations(page)).toEqual([])
    const saved = await api.from('user_logs').select('meal').order('meal')
    expect(saved.data?.map((row) => row.meal)).toEqual(['Chai', 'lunch', 'lunch'])
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
  await expect(review).toContainText('Carbs are furthest behind, 60 of 280 g.')
  await expect(review).toContainText('Sodium is high, mostly from Test tea')
  // On a wide screen the review sits beside the ring; on a phone it sits under it.
  const circle = ring.locator('svg').first()
  const [circleBox, reviewBox] = await Promise.all([circle.boundingBox(), review.boundingBox()])
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    expect(reviewBox!.x).toBeGreaterThan(circleBox!.x + circleBox!.width)
    // Beside the ring, the note for the day and what the last seven days say.
    const note = page.getByRole('region', { name: 'A note for today' })
    await expect(note).toContainText('1 of 7 days logged in the last week.')
    await expect(note).toContainText('Yesterday: nothing logged.')
    await expect(note.getByRole('link', { name: 'See your week' })).toHaveAttribute('href', '/trends')
  } else {
    expect(reviewBox!.y).toBeGreaterThan(circleBox!.y + circleBox!.height)
  }
  expect(await accessibilityViolations(page)).toEqual([])
  expect(await scrollsSideways(page)).toBe(false)
  expect(await cspViolations(page)).toEqual([])
})
