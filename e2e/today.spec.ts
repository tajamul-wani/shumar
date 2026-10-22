import { expect, test } from '@playwright/test'
import {
  accessibilityViolations,
  apiClient,
  createTestUser,
  cspViolations,
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
      await expect(page.getByRole('region', { name: 'Meals' }).getByRole('listitem')).toHaveText([
        /^BreakfastTest tea · Test bread300 kcal$/,
        /^DinnerTest rice300 kcal$/,
      ])
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
    await meals.getByRole('button', { name: /^Breakfast/ }).click()
    const blocking = await accessibilityViolations(page)
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
    const size = page.viewportSize()
    await page.setViewportSize({ width: 320, height: 640 })
    expect(await scrollsSideways(page)).toBe(false)
    if (size) await page.setViewportSize(size)

    await meals.getByRole('button', { name: 'Remove Test bread' }).click()
    await expect(page.getByText('Removed Test bread from breakfast.')).toBeVisible()
    await expect(ring).toContainText('100kcal eaten')
    await expect(page.getByRole('button', { name: 'Undo' })).toBeFocused()
    await expect.poll(names).toEqual([{ food_name: 'Test tea' }])

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText('Put Test bread back in breakfast.')).toBeVisible()
    await expect(ring).toContainText('300kcal eaten')
    await expect.poll(names).toEqual([{ food_name: 'Test bread' }, { food_name: 'Test tea' }])

    await meals.getByRole('link', { name: 'Change Test tea' }).click()
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
