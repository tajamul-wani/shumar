import { expect, test } from '@playwright/test'
import {
  FIRST_RUN_ANSWERS,
  FIRST_RUN_SCREENS,
  SCREENS,
  WIDTHS,
  readTestUsers,
  scrollsSideways,
  signInAs,
} from './support.ts'

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

for (const { path, title, heading } of FIRST_RUN_SCREENS) {
  test(`first-run ${title} fits every width, with no app navigation`, async ({ page }) => {
    await page.addInitScript(
      (answers) => localStorage.setItem('shumar-cache:first-run', JSON.stringify(answers)),
      FIRST_RUN_ANSWERS,
    )
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeAttached()

    for (const size of WIDTHS) {
      await page.setViewportSize(size)
      expect(await scrollsSideways(page), `sideways scroll at ${size.width} px`).toBe(false)
      await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
    }
  })
}
