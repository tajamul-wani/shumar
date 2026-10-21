import { expect, test } from '@playwright/test'
import { SCREENS, readTestUsers, scrollsSideways, signInAs } from './support.ts'

// Every width the UI skill asks for, plus 1023 and 1024 px on each side of the side navigation,
// and a phone held sideways.
const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1023, height: 768 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 844, height: 390 },
] as const

const SIDE_NAV_FROM = 1024

for (const { path, title, heading } of SCREENS) {
  test(`${title} fits every width and shows the right navigation`, async ({ page }) => {
    await signInAs(page, readTestUsers().a.session)
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeAttached()

    for (const size of WIDTHS) {
      await page.setViewportSize(size)
      expect(await scrollsSideways(page), `sideways scroll at ${size.width} px`).toBe(false)
      await expect(
        page.getByRole('navigation', { name: 'Main' }),
        `one navigation at ${size.width} px`,
      ).toHaveCount(1)
      const aside = page.getByRole('complementary')
      if (size.width >= SIDE_NAV_FROM)
        await expect(aside, `side navigation at ${size.width} px`).toBeVisible()
      else await expect(aside, `no side navigation at ${size.width} px`).toBeHidden()
    }
  })
}
