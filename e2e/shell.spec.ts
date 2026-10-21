import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { SCREENS, cspViolations, readTestUsers, signInAs, watchCsp } from './support.ts'

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
        await expect(page.getByRole('link', { name: 'Log food' })).toBeVisible()
      }
    })

    for (const { path, heading } of SCREENS) {
      test(`${heading} fits at 320 px, passes accessibility checks and keeps to the security policy`, async ({
        page,
      }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeAttached()

        const results = await new AxeBuilder({ page }).analyze()
        const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])

        await page.setViewportSize({ width: 320, height: 640 })
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
          ),
        ).toBe(false)
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
