import { expect, test, type Page } from '@playwright/test'
import { accessibilityViolations, cspViolations, scrollsSideways, watchCsp } from './support.ts'

async function check(page: Page, step: string) {
  const blocking = await accessibilityViolations(page)
  expect(blocking, `${step}: ${JSON.stringify(blocking, null, 2)}`).toEqual([])
  const size = page.viewportSize()
  await page.setViewportSize({ width: 320, height: 640 })
  expect(await scrollsSideways(page), `${step}: sideways scroll at 320 px`).toBe(false)
  if (size) await page.setViewportSize(size)
}

const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue' })

/** Taps a choice's card, as a person does, and checks its radio button is now chosen. */
async function choose(page: Page, name: string | RegExp) {
  const radio = page.getByRole('radio', typeof name === 'string' ? { name, exact: true } : { name })
  await page.locator('label').filter({ has: radio }).click()
  await expect(radio).toBeChecked()
}

for (const theme of ['dark', 'light'] as const) {
  test(`every first-run screen passes accessibility checks and fits 320 px, ${theme} theme`, async ({
    page,
  }) => {
    await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
    await watchCsp(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Shumār' })).toBeVisible()
    await check(page, 'welcome')

    await page.getByRole('link', { name: 'Get started' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'How old are you?' })).toBeFocused()
    await continueButton(page).click()
    await expect(page.getByRole('alert')).toHaveText('Enter your age in whole years, from 18 to 100.')
    await check(page, 'age, with an error')
    await page.getByLabel('Age').fill('34')
    await continueButton(page).click()

    await expect(page.getByRole('heading', { level: 1, name: 'What is your sex?' })).toBeVisible()
    await check(page, 'sex')
    await choose(page, 'Female')
    await continueButton(page).click()

    await page.getByLabel('Weight').fill('62')
    await page.getByRole('button', { name: 'lb' }).click()
    await expect(page.getByLabel('Weight')).toHaveValue('136.7')
    await check(page, 'weight, in pounds')
    await continueButton(page).click()

    await page.getByLabel('Height').fill('160')
    await check(page, 'height')
    await continueButton(page).click()

    await choose(page, /Moderately active/)
    await check(page, 'activity')
    await continueButton(page).click()

    await choose(page, /Lose weight/)
    await expect(page.getByRole('group', { name: 'How fast?' })).toBeVisible()
    await check(page, 'goal, with the speeds')
    expect(await cspViolations(page)).toEqual([])
  })
}

test('the answers survive a reload, Enter goes on, and the last step hands over to Google', async ({
  page,
}) => {
  // Stop at Supabase: Google's own screen can't be automated.
  await page.route('**/auth/v1/authorize**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'Google sign-in' }),
  )
  await page.goto('/start/age')
  await page.getByLabel('Age').fill('30')
  await page.getByLabel('Age').press('Enter')
  await choose(page, 'Male')
  await continueButton(page).click()
  await page.getByLabel('Weight').fill('80')
  await page.getByLabel('Weight').press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'How tall are you?' })).toBeVisible()

  await page.reload()
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page.getByLabel('Weight')).toHaveValue('80')
  await continueButton(page).click()

  await page.getByLabel('Height').fill('175')
  await continueButton(page).click()
  await choose(page, /Lightly active/)
  await continueButton(page).click()
  await choose(page, /Keep my weight/)

  const authorize = page.waitForRequest('**/auth/v1/authorize**')
  await page.getByRole('button', { name: 'Sign in with Google to save' }).click()
  expect(new URL((await authorize).url()).searchParams.get('provider')).toBe('google')
})

test('an address further on goes back to the first question left', async ({ page }) => {
  await page.goto('/start/goal')
  await expect(page).toHaveURL('/start/age')
  await expect(page.getByRole('heading', { level: 1, name: 'How old are you?' })).toBeVisible()
})
