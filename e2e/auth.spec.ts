import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { apiClient, createTestUser, cspViolations, readTestUsers, signInAs, watchCsp } from './support.ts'

test('Sign in with Google hands over to Supabase with a PKCE challenge', async ({ page, baseURL }) => {
  // Stop at Supabase: Google's own screen can't be automated.
  await page.route('**/auth/v1/authorize**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'Google sign-in' }),
  )
  await page.goto('/')
  const authorize = page.waitForRequest('**/auth/v1/authorize**')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()

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
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()

    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
  })
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`Signed in, ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
      await watchCsp(page)
      await signInAs(page, readTestUsers().a.session)
      await page.goto('/')
    })

    test('shows the signed-in account and a way to sign out', async ({ page }) => {
      await expect(page.getByText(readTestUsers().a.email)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    })

    test('fits at 320 px, passes accessibility checks and keeps to the security policy', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
      await page.setViewportSize({ width: 320, height: 640 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false)

      const results = await new AxeBuilder({ page }).analyze()
      const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
      expect(await cspViolations(page)).toEqual([])
    })
  })
}

test('Sign out ends the session and clears the device, keeping only the theme', async ({ page }) => {
  // Its own user, so ending the session can't affect the other tests.
  const user = await createTestUser('signout')
  await signInAs(page, user.session)
  await page.addInitScript(() => {
    localStorage.setItem('shumar-theme', 'light')
    localStorage.setItem('shumar-cache:today', '[]')
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['shumar-theme'])

  const refresh = await apiClient().auth.refreshSession({ refresh_token: user.session.refresh_token })
  expect(refresh.error, 'the server should no longer accept the old session').not.toBeNull()
})
