import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  THEMES,
  accessibilityViolations,
  apiClient,
  createTestUser,
  cspViolations,
  loneWords,
  scrollsSideways,
  signInAs,
  useTheme,
  watchCsp,
} from './support.ts'

// A food of the person's own, from its pack (SHU-31). The values typed in are test fixtures with
// easy numbers, not nutrition data.

/** Accessibility, and on phones no word alone on a line from 320 px up and no sideways scroll. */
async function checkStep(page: Page, step: string) {
  const blocking = await accessibilityViolations(page)
  expect(blocking, `${step}: ${JSON.stringify(blocking, null, 2)}`).toEqual([])
  const size = page.viewportSize()
  if (!size || size.width >= 1024) return
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await loneWords(page), `${step} at ${width} px`).toEqual([])
  }
  await page.setViewportSize({ width: 320, height: 640 })
  expect(await scrollsSideways(page), `${step}: sideways scroll at 320 px`).toBe(false)
  await page.setViewportSize(size)
}

async function fill(popup: Locator, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values))
    await popup.getByLabel(label, { exact: true }).fill(value)
}

for (const theme of THEMES) {
  test(`a food from its pack: add it, find it first, log it, change it and remove it, ${theme} theme`, async ({
    page,
  }) => {
    const user = await createTestUser('my-foods')
    const api = apiClient(user.session.access_token)
    try {
      await useTheme(page, theme)
      await watchCsp(page)
      await signInAs(page, user.session)
      await page.goto('/')
      const wide = (page.viewportSize()?.width ?? 0) >= 1024
      await page
        .getByRole('button', { name: 'Add food' })
        .nth(wide ? 0 : 1)
        .click()
      const popup = page.getByRole('dialog', { name: 'Add food' })
      await popup.getByRole('button', { name: 'Lunch', exact: true }).click()
      const search = popup.getByRole('searchbox', { name: 'Search foods' })
      const results = popup.getByRole('list', { name: 'Search results' })
      const lunch = page.getByRole('region', { name: 'Meals' }).getByRole('article', { name: 'Lunch' })

      // Nothing matches, so the popup offers to add it from the pack, with the search as its name.
      await search.fill('kxtest paneer')
      await expect(
        popup.getByRole('paragraph').filter({ hasText: 'No foods match "kxtest paneer".' }),
      ).toBeVisible()
      await popup.getByRole('button', { name: 'Add it from the pack' }).click()
      await expect(popup.getByRole('heading', { name: 'Add a food from its pack' })).toBeFocused()
      await expect(popup.getByLabel('Name', { exact: true })).toHaveValue('kxtest paneer')
      await checkStep(page, 'the form')

      // A typo in the calories is caught before saving.
      await popup.getByRole('button', { name: 'Per serving' }).click()
      await fill(popup, {
        Name: 'Kxtest paneer',
        Brand: 'Kxbrand',
        'One serving is': '30',
        Calories: '9',
        Protein: '6',
        Carbs: '0.6',
        Fat: '7.2',
        Sodium: '6',
      })
      await popup.getByRole('button', { name: 'Save food' }).click()
      await expect(popup.getByRole('heading', { name: 'Check these numbers' })).toBeVisible()
      await checkStep(page, 'the calories check')
      await popup.getByRole('button', { name: 'Fix the numbers' }).click()
      await expect(popup.getByLabel('Calories', { exact: true })).toBeFocused()
      await popup.getByLabel('Calories', { exact: true }).fill('90')
      await popup.getByRole('button', { name: 'Save food' }).click()

      // Saved: the search finds it first, marked as theirs, and it goes into lunch as one serving.
      await expect(popup.getByText('Saved to your foods')).toBeVisible()
      const first = results.getByRole('listitem').first()
      await expect(first).toContainText('Kxtest paneer (Kxbrand)')
      await expect(first).toContainText('Yours')
      await first.getByRole('button').first().click()
      await expect(popup.getByRole('heading', { name: 'Kxtest paneer (Kxbrand)' })).toBeFocused()
      await expect(popup.getByText('Your food, from its pack')).toBeVisible()
      await checkStep(page, "the food's page")
      await popup.getByRole('button', { name: 'Add to lunch' }).click()
      await expect(lunch).toContainText('Kxtest paneer (Kxbrand)')

      // Before any search, their foods are listed and added in one tap.
      await search.fill('')
      await expect(popup.getByRole('heading', { name: 'Your foods' })).toBeVisible()
      await popup.getByRole('button', { name: 'Add 1 serving Kxtest paneer (Kxbrand)' }).click()
      await expect(lunch.getByRole('listitem')).toHaveCount(1)
      await expect(lunch).toContainText('×2')

      // Changed: the form shows the label as it was typed, and the food opens again with the change.
      await search.fill('kxtest paneer')
      await results.getByRole('listitem').first().getByRole('button').first().click()
      await popup.getByRole('button', { name: 'Edit' }).click()
      await expect(popup.getByRole('heading', { name: 'Change your food' })).toBeFocused()
      await expect(popup.getByLabel('Calories', { exact: true })).toHaveValue('90')
      await popup.getByLabel('Calories', { exact: true }).fill('93')
      await popup.getByRole('button', { name: 'Save changes' }).click()
      await expect(popup.getByRole('heading', { name: 'Kxtest paneer (Kxbrand)' })).toBeFocused()
      await expect(popup).toContainText('93')

      // Removed: gone from their foods, while what they logged stays as it was logged.
      await popup.getByRole('button', { name: 'Remove' }).click()
      await expect(popup.getByText('Removed from your foods')).toBeVisible()
      await expect(lunch).toContainText('Kxtest paneer (Kxbrand)')
      await popup.getByRole('button', { name: 'Done' }).click()

      expect(await cspViolations(page)).toEqual([])
      const left = await api.from('my_foods').select('id')
      expect(left.data).toEqual([])
      const logged = await api.from('user_logs').select('food_source, unit_name, kcal')
      expect(logged.data).toEqual([
        { food_source: 'mine', unit_name: '1 serving', kcal: 90 },
        { food_source: 'mine', unit_name: '1 serving', kcal: 90 },
      ])
    } finally {
      await api.from('user_logs').delete().eq('user_id', user.session.user.id)
      await api.from('my_foods').delete().eq('user_id', user.session.user.id)
    }
  })
}
