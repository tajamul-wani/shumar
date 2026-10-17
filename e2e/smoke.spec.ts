import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
}

test.describe('App shell', () => {
  test('loads with the app name and title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Shumār')
    await expect(page.getByRole('heading', { level: 1, name: 'Shumār' })).toBeVisible()
  })

  test('has no horizontal scroll, including at 320 px', async ({ page }) => {
    await page.goto('/')
    expect(await hasHorizontalScroll(page)).toBe(false)
    await page.setViewportSize({ width: 320, height: 640 })
    expect(await hasHorizontalScroll(page)).toBe(false)
  })

  test('has no serious or critical accessibility violations', async ({ page }) => {
    await page.goto('/')
    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
  })
})
