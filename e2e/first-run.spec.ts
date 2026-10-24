import { expect, test, type Page } from '@playwright/test'
import { checkScreen, choose, cspViolations, watchCsp } from './support.ts'

const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue' })

for (const theme of ['dark', 'light'] as const) {
  test(`every first-run screen passes accessibility checks and fits 320 px, ${theme} theme`, async ({
    page,
  }) => {
    // One walk through all eight screens, with an accessibility scan on each: about 20 s in WebKit.
    test.slow()
    await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
    await watchCsp(page)
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Your daily tally, built for Kashmiri food.' }),
    ).toBeVisible()
    await checkScreen(page, 'home')

    await page.getByRole('link', { name: 'Get started' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'How old are you?' })).toBeFocused()
    await continueButton(page).click()
    await expect(page.getByRole('alert')).toHaveText('Enter your age in whole years, from 18 to 100.')
    await checkScreen(page, 'age, with an error')
    await page.getByLabel('Age').fill('34')
    await continueButton(page).click()

    await expect(page.getByRole('heading', { level: 1, name: 'What is your sex?' })).toBeVisible()
    await checkScreen(page, 'sex')
    await choose(page, 'Female')
    await continueButton(page).click()

    await page.getByLabel('Weight').fill('62')
    await page.getByRole('button', { name: 'lb' }).click()
    await expect(page.getByLabel('Weight')).toHaveValue('136.7')
    await checkScreen(page, 'weight, in pounds')
    await continueButton(page).click()

    await page.getByLabel('Height').fill('160')
    await checkScreen(page, 'height')
    await continueButton(page).click()

    await choose(page, /Moderately active/)
    await checkScreen(page, 'activity')
    await continueButton(page).click()

    await choose(page, /Lose weight/)
    await expect(page.getByRole('group', { name: 'How fast?' })).toBeVisible()
    await checkScreen(page, 'goal, with the speeds')
    await page.getByRole('button', { name: 'See my daily target' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Your daily target' })).toBeFocused()
    await expect(page.getByRole('region', { name: 'Daily target' })).toContainText('kcal')
    await page.getByRole('button', { name: 'How this is worked out' }).click()
    await expect(page.getByText(/Mifflin-St Jeor formula \(1990\)/)).toBeVisible()
    await checkScreen(page, 'daily target, with how it is worked out')
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
  await page.getByRole('button', { name: 'See my daily target' }).click()
  await expect(page.getByRole('region', { name: 'Your answers' })).toContainText('GoalKeep my weight')

  const authorize = page.waitForRequest('**/auth/v1/authorize**')
  await page.getByRole('button', { name: 'Sign in with Google to save' }).click()
  expect(new URL((await authorize).url()).searchParams.get('provider')).toBe('google')
})

test('an address further on goes back to the first question left', async ({ page }) => {
  await page.goto('/start/goal')
  await expect(page).toHaveURL('/start/age')
  await expect(page.getByRole('heading', { level: 1, name: 'How old are you?' })).toBeVisible()
})
