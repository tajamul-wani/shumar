import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { apiClient, createTestUser, readTestUsers, saveTestProfile, signInAs } from './support.ts'

test('Signing in to an existing account hands over to Supabase with a PKCE challenge', async ({
  page,
  baseURL,
}) => {
  // Stop at Supabase: Google's own screen can't be automated.
  await page.route('**/auth/v1/authorize**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'Google sign-in' }),
  )
  await page.goto('/')
  const authorize = page.waitForRequest('**/auth/v1/authorize**')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  const url = new URL((await authorize).url())
  expect(url.searchParams.get('provider')).toBe('google')
  expect(url.searchParams.get('redirect_to')).toBe(new URL(baseURL ?? '').origin)
  expect(url.searchParams.get('code_challenge')).toBeTruthy()
  expect(url.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256')
})

for (const theme of ['dark', 'light'] as const) {
  test(`explains when Google sends the visitor back with an error, ${theme} theme`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
    await page.goto('/?error=access_denied&error_description=The+user+cancelled')
    await expect(page.getByRole('alert')).toHaveText("We couldn't sign you in with Google. Please try again.")
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()

    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
  })
}

test('shows the signed-in account on the You screen', async ({ page }) => {
  await signInAs(page, readTestUsers().a.session)
  await page.goto('/you')
  await expect(page.getByRole('region', { name: 'Account' })).toContainText(readTestUsers().a.email)
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
})

test('Sign out ends the session and clears the device, keeping only the theme', async ({ page }) => {
  // Its own user, so ending the session can't affect the other tests.
  const user = await createTestUser('signout')
  await signInAs(page, user.session)
  await page.addInitScript(() => {
    localStorage.setItem('shumar-theme', 'light')
    localStorage.setItem('shumar-cache:today', '[]')
    localStorage.setItem('shumar-cache:first-run', '{"ageYears":30,"weightUnit":"kg"}')
  })
  await page.goto('/you')
  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page).toHaveURL('/')
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['shumar-theme'])

  const refresh = await apiClient().auth.refreshSession({ refresh_token: user.session.refresh_token })
  expect(refresh.error, 'the server should no longer accept the old session').not.toBeNull()
})

test('Download my data gives a file with the answers, the target and every log', async ({ page }) => {
  const user = await createTestUser('download')
  await saveTestProfile(user.session.access_token)
  const { error } = await apiClient(user.session.access_token).from('user_logs').insert({
    log_date: '2026-10-24',
    meal: 'breakfast',
    food_name: 'Egg, whole, raw, fresh',
    food_source: 'usda',
    food_source_id: '171287',
    quantity: 2,
    unit_name: 'large',
    grams: 100,
    kcal: 143,
    protein: 12.56,
    carbs: 0.72,
    fat: 9.51,
    sodium_mg: 142,
  })
  expect(error).toBeNull()
  await signInAs(page, user.session)
  await page.goto('/you')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download my data' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^shumar-data-\d{4}-\d{2}-\d{2}\.json$/)
  const data = JSON.parse(
    await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString()),
  )
  expect(data.account.email).toBe(user.email)
  expect(data.target).toMatchObject({ kcal: 2176, protein: 128, carbs: 280, fat: 60 })
  expect(data.logs).toEqual([
    expect.objectContaining({
      date: '2026-10-24',
      food: 'Egg, whole, raw, fresh',
      quantity: 2,
      unit: 'large',
      kcal: 143,
    }),
  ])
})

test('Delete my account removes the account, the answers and every log, and ends the session', async ({
  page,
}) => {
  const user = await createTestUser('delete')
  await saveTestProfile(user.session.access_token)
  const api = apiClient(user.session.access_token)
  const { error } = await api.from('user_logs').insert({
    log_date: '2026-10-24',
    meal: 'lunch',
    food_name: 'Test item',
    food_source: 'usda',
    quantity: 1,
    unit_name: 'g',
    grams: 1,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  })
  expect(error).toBeNull()
  await signInAs(page, user.session)
  await page.goto('/you')

  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page.getByText('Delete your account and every log?')).toBeVisible()
  await page.getByRole('button', { name: 'Keep my account' }).click()
  await expect(page.getByText('Delete your account and every log?')).toBeHidden()

  // The last button stays off until the person types the word, and the word is forgotten when they back out.
  await page.getByRole('button', { name: 'Delete my account' }).click()
  const confirmWord = page.getByRole('textbox', { name: 'Type delete to confirm' })
  const deleteButton = page.getByRole('button', { name: 'Yes, delete everything' })
  await expect(deleteButton).toBeDisabled()
  await confirmWord.fill('delet')
  await expect(deleteButton).toBeDisabled()
  await confirmWord.fill(' Delete ')
  await expect(deleteButton).toBeEnabled()
  await page.getByRole('button', { name: 'Keep my account' }).click()
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(confirmWord).toHaveValue('')
  await expect(deleteButton).toBeDisabled()
  await confirmWord.fill('delete')
  await deleteButton.click()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page).toHaveURL('/')
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k !== 'shumar-theme'))).toEqual([])

  // The old token still names the user, but there is nothing of theirs left, and the account is gone.
  expect((await api.from('user_logs').select('id')).data).toEqual([])
  expect((await api.from('profiles').select('user_id')).data).toEqual([])
  const refresh = await apiClient().auth.refreshSession({ refresh_token: user.session.refresh_token })
  expect(refresh.error, 'the deleted account should have no session').not.toBeNull()
})
