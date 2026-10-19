import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { cspViolations, watchCsp } from './support.ts'

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`App shell, ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
      await watchCsp(page)
      await page.goto('/')
    })

    test('loads with the app name and title', async ({ page }) => {
      await expect(page).toHaveTitle('Shumār')
      await expect(page.getByRole('heading', { level: 1, name: 'Shumār' })).toBeVisible()
    })

    test('applies the theme and its base color token', async ({ page }) => {
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const colors = await page.evaluate(() => {
        const probe = document.createElement('div')
        probe.style.background = getComputedStyle(document.documentElement).getPropertyValue('--koshur-base')
        document.body.append(probe)
        const token = getComputedStyle(probe).backgroundColor
        probe.remove()
        return { body: getComputedStyle(document.body).backgroundColor, token }
      })
      expect(colors.body).toBe(colors.token)
    })

    test('uses the Manrope typeface', async ({ page }) => {
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.fonts.check('16px Manrope'))).toBe(true)
    })

    test('has no horizontal scroll, including at 320 px', async ({ page }) => {
      expect(await hasHorizontalScroll(page)).toBe(false)
      await page.setViewportSize({ width: 320, height: 640 })
      expect(await hasHorizontalScroll(page)).toBe(false)
    })

    test('is served with the security policy and breaks none of it', async ({ page }) => {
      const response = await page.request.get('/')
      expect(response.headers()['content-security-policy']).toContain("default-src 'self'")
      expect(response.headers()['x-frame-options']).toBe('DENY')
      await page.evaluate(() => document.fonts.ready)
      expect(await cspViolations(page)).toEqual([])
    })

    test('has no serious or critical accessibility violations', async ({ page }) => {
      const results = await new AxeBuilder({ page }).analyze()
      const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
    })
  })
}

test('follows the device theme when nothing is saved', async ({ browser }) => {
  for (const scheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ colorScheme: scheme })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme)
    await context.close()
  }
})
