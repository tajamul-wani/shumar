import { expect, test } from '@playwright/test'
import { DAILY_NOTES } from '../src/lib/notes.ts'
import {
  FIRST_RUN_ANSWERS,
  apiClient,
  createTestUser,
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

// The note for the day changes every day, so the sweep below only ever sees one of them. Each note
// is put in the card in turn and measured at every width where the card shows, so no day's note
// can leave a word alone on a line.
test('every note for the day leaves no word alone on a line', async ({ page }) => {
  await signInAs(page, readTestUsers().a.session)
  await page.goto('/')
  const note = page.getByRole('region', { name: 'A note for today' }).getByRole('paragraph').first()
  for (const size of WIDTHS.filter(({ width }) => width >= 1024)) {
    await page.setViewportSize(size)
    await expect(note).toBeVisible()
    for (const text of DAILY_NOTES) {
      await note.evaluate((element, value) => {
        element.textContent = value
      }, text)
      expect.soft(await loneWords(page), `"${text}" at ${size.width} px`).toEqual([])
    }
  }
})

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

// Today's meal cards and the search results show only with food, so each is swept with some.
test('Today with meals, and search results, leave no word alone on a line', async ({ page }) => {
  const user = await createTestUser('orphans-meals')
  const api = apiClient(user.session.access_token)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  // Placeholder logs with long and short names: they only fill the cards and are not nutrition data.
  const food = (
    meal: string,
    name: string,
    hour: number,
    quantity: number,
    unitName: string,
    grams: number,
  ) => ({
    log_date: today,
    logged_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour).toISOString(),
    meal,
    food_name: name,
    food_source: 'usda',
    quantity,
    unit_name: unitName,
    grams,
    kcal: 155,
    protein: 12.5,
    carbs: 1,
    fat: 10.5,
    sodium_mg: 120,
  })
  const inserted = await api
    .from('user_logs')
    .insert([
      food('breakfast', 'Test egg, whole, cooked, hard-boiled', 8, 2, '1 large', 100),
      food('breakfast', 'Test tea', 8, 1, '1 cup', 240),
      food('breakfast', 'Test tea', 8, 1, '1 cup', 240),
      food(
        'lunch',
        'Test rice, white, long-grain, regular, unenriched, cooked without salt',
        13,
        150,
        'g',
        150,
      ),
    ])
  expect(inserted.error).toBeNull()
  try {
    await signInAs(page, user.session)
    await page.goto('/')
    await expect(page.getByRole('region', { name: 'Meals' })).toContainText('Test tea')
    for (const size of WIDTHS) {
      await page.setViewportSize(size)
      expect.soft(await loneWords(page), `Today with meals at ${size.width} px`).toEqual([])
    }

    await page.goto('/log')
    await page.getByRole('searchbox', { name: 'Search foods' }).fill('egg')
    await expect(page.getByRole('list', { name: 'Search results' })).toBeVisible()
    for (const size of WIDTHS) {
      await page.setViewportSize(size)
      expect.soft(await loneWords(page), `search results at ${size.width} px`).toEqual([])
    }
  } finally {
    await api.from('user_logs').delete().eq('user_id', user.session.user.id)
  }
})
