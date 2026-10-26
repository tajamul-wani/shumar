import { expect, test, type Page } from '@playwright/test'
import {
  SCREENS,
  accessibilityViolations,
  apiClient,
  createTestUser,
  cspViolations,
  readTestUsers,
  scrollsSideways,
  signInAs,
  watchCsp,
} from './support.ts'

// The side navigation takes over from the tab bar at this width (Tailwind's lg breakpoint).
const SIDE_NAV_FROM = 1024

function hasSideNav(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= SIDE_NAV_FROM
}

/** Whichever main navigation this screen size shows. */
function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main' })
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`App shell, ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
      await watchCsp(page)
      await signInAs(page, readTestUsers().a.session)
    })

    test('shows the navigation for this screen size', async ({ page }) => {
      await page.goto('/')
      await expect(mainNav(page)).toHaveCount(1)
      await expect(mainNav(page).getByRole('link')).toHaveText(['Today', 'Trends', 'You'])
      await expect(mainNav(page).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
      if (hasSideNav(page)) {
        await expect(page.getByRole('button', { name: /^Theme: / })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Log food' })).toBeHidden()
      } else {
        await expect(page.getByRole('button', { name: 'Add food' }).last()).toBeVisible()
      }
    })

    for (const { path, title, heading } of SCREENS) {
      test(`${title} fits at 320 px, passes accessibility checks and keeps to the security policy`, async ({
        page,
      }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeAttached()

        const blocking = await accessibilityViolations(page)
        expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])

        await page.setViewportSize({ width: 320, height: 640 })
        expect(await scrollsSideways(page)).toBe(false)
        expect(await cspViolations(page)).toEqual([])
      })
    }
  })
}

test.describe('Moving around', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, readTestUsers().a.session)
  })

  test('links, back and reload all keep the right screen', async ({ page }) => {
    await page.goto('/')
    await mainNav(page).getByRole('link', { name: 'Trends' }).click()
    await expect(page).toHaveURL('/trends')
    await expect(page.getByRole('heading', { level: 1, name: 'Trends' })).toBeFocused()

    await mainNav(page).getByRole('link', { name: 'You' }).click()
    await expect(page).toHaveURL('/you')
    await page.goBack()
    await expect(page).toHaveURL('/trends')
    await expect(page.getByRole('heading', { level: 1, name: 'Trends' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Trends' })).toBeVisible()
  })

  test('an unknown address goes to Today', async ({ page }) => {
    await page.goto('/no-such-screen')
    await expect(page).toHaveURL('/')
  })

  test('the theme chosen on the You screen applies and survives a reload', async ({ page }) => {
    await page.goto('/you')
    const group = page.getByRole('group', { name: 'Theme' })
    await group.getByRole('button', { name: 'Light' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(group.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')

    await group.getByRole('button', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

test('the food sources page opens from the You screen and lists the USDA releases in use', async ({
  page,
}) => {
  await signInAs(page, readTestUsers().a.session)
  await page.goto('/you')
  await page.getByRole('link', { name: 'Where food values come from' }).click()
  await expect(page).toHaveURL('/sources')
  await expect(page.getByRole('listitem')).toHaveText([
    'Foundation Foods, April 2026',
    'SR Legacy, April 2018',
  ])
})

test('the end of a long screen is never under the add button on a phone', async ({ page }) => {
  const user = await createTestUser('clear')
  const api = apiClient(user.session.access_token)
  // Placeholder logs with easy numbers, enough to fill a phone screen; not nutrition data.
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const meals = ['breakfast', 'lunch', 'evening_tea', 'dinner', 'snack']
  const inserted = await api.from('user_logs').insert(
    meals.map((meal) => ({
      log_date: today,
      meal,
      food_name: 'Test item',
      food_source: 'usda',
      quantity: 100,
      unit_name: 'g',
      grams: 100,
      kcal: 100,
      protein: 1,
      carbs: 1,
      fat: 1,
    })),
  )
  expect(inserted.error).toBeNull()

  try {
    await signInAs(page, user.session)
    await page.setViewportSize({ width: 360, height: 640 })
    await page.goto('/')
    const list = page.getByRole('region', { name: 'Meals' })
    await expect(list).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

    const button = await page.getByRole('button', { name: 'Add food' }).last().boundingBox()
    const end = await list.boundingBox()
    if (!button || !end) throw new Error('The add button or the meals list is not on the screen')
    expect(end.y + end.height).toBeLessThanOrEqual(button.y)
  } finally {
    await api.from('user_logs').delete().eq('user_id', user.session.user.id)
  }
})
