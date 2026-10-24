import { expect, test } from '@playwright/test'
import {
  FIRST_RUN_ANSWERS,
  FIRST_RUN_SCREENS,
  SCREENS,
  THEMES,
  WIDTHS,
  loneWords,
  readTestUsers,
  signInAs,
  useTheme,
} from './support.ts'

// No heading, button, label or short text ends with one word alone on its last line, at any
// width, in either theme (shumar-no-orphans). Fix the words or the room they have, never this test.

for (const theme of THEMES) {
  for (const { path, title, heading } of SCREENS) {
    test(`${title} leaves no word alone on a line, ${theme}`, async ({ page }) => {
      await signInAs(page, readTestUsers().a.session)
      await useTheme(page, theme)
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeAttached()
      for (const size of WIDTHS) {
        await page.setViewportSize(size)
        expect(await loneWords(page), `${title} at ${size.width} px, ${theme}`).toEqual([])
      }
    })
  }

  for (const { path, title, heading } of FIRST_RUN_SCREENS) {
    test(`first-run ${title} leaves no word alone on a line, ${theme}`, async ({ page }) => {
      await page.addInitScript(
        (answers) => localStorage.setItem('shumar-cache:first-run', JSON.stringify(answers)),
        FIRST_RUN_ANSWERS,
      )
      await useTheme(page, theme)
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeAttached()
      for (const size of WIDTHS) {
        await page.setViewportSize(size)
        expect(await loneWords(page), `${title} at ${size.width} px, ${theme}`).toEqual([])
      }
    })
  }
}
