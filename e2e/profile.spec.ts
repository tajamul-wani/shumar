import { expect, test, type Page } from '@playwright/test'
import {
  FIRST_RUN_ANSWERS,
  apiClient,
  checkScreen,
  choose,
  createTestUser,
  cspViolations,
  saveTestProfile,
  signInAs,
  watchCsp,
} from './support.ts'

test('answers given before sign-in are saved to the profile, then cleared from the device', async ({
  page,
}) => {
  // Its own user, so the saved profile can't affect the other tests.
  const user = await createTestUser('profile')
  await page.addInitScript(
    (answers) => localStorage.setItem('shumar-cache:first-run', JSON.stringify(answers)),
    FIRST_RUN_ANSWERS,
  )
  await signInAs(page, user.session)
  // The answers are on the device when the app first loads, as after a real sign-in.
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('shumar-cache:first-run'))).toBeNull()

  const { data, error } = await apiClient(user.session.access_token)
    .from('profiles')
    .select('age_years, sex, weight_kg, weight_unit, height_cm, activity, goal, loss_kg_per_week')
    .single()
  expect(error).toBeNull()
  expect(data).toEqual({
    age_years: 30,
    sex: 'male',
    weight_kg: 80,
    weight_unit: 'kg',
    height_cm: 175,
    activity: 'light',
    goal: 'lose',
    loss_kg_per_week: 0.5,
  })
})

/** Answers the six questions as FIRST_RUN_ANSWERS does: a target of 2,176 kcal. */
async function answerEveryQuestion(page: Page) {
  await page.getByLabel('Age').fill('30')
  await continueButton(page).click()
  await choose(page, 'Male')
  await continueButton(page).click()
  await page.getByLabel('Weight').fill('80')
  await continueButton(page).click()
  await page.getByLabel('Height').fill('175')
  await continueButton(page).click()
  await choose(page, /Lightly active/)
  await continueButton(page).click()
  await choose(page, /Lose weight/)
  await page.getByRole('button', { name: 'See my daily target' }).click()
}

const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue' })

for (const theme of ['dark', 'light'] as const) {
  test(`someone signed in without a target sets one from Today, ${theme} theme`, async ({ page }) => {
    const user = await createTestUser(`set-target-${theme}`)
    await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
    await watchCsp(page)
    await signInAs(page, user.session)
    await page.goto('/')

    const card = page.getByRole('region', { name: 'Set your daily target' })
    await checkScreen(page, 'Today, with the card to set a target')
    await card.getByRole('link', { name: 'Set my target' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'How old are you?' })).toBeFocused()
    // The app's own navigation stays, and the add button makes way for the questions.
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Add food' })).toHaveCount(0)
    await checkScreen(page, 'age, signed in')

    await answerEveryQuestion(page)
    await expect(page.getByRole('region', { name: 'Daily target' })).toContainText('2,176kcal')
    await checkScreen(page, 'daily target, signed in')
    await page.getByRole('button', { name: 'Save my target' }).click()

    await expect(page).toHaveURL('/')
    const ring = page.getByRole('region', { name: 'Calories and macros' })
    await expect(ring).toContainText('2,176kcal left')
    await expect(card).toHaveCount(0)
    expect(await cspViolations(page)).toEqual([])
  })

  test(`the You screen shows the target and its details, and a changed detail saves a new target, ${theme} theme`, async ({
    page,
  }) => {
    const user = await createTestUser(`you-target-${theme}`)
    await saveTestProfile(user.session.access_token)
    await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
    await watchCsp(page)
    await signInAs(page, user.session)
    await page.goto('/you')

    const target = page.getByRole('region', { name: 'Daily target' })
    await expect(target).toContainText('2,176kcal')
    await expect(target).toContainText('Set from your details to lose about 0.5 kg a week')
    await expect(target).toContainText('Protein128 g')
    const details = page.getByRole('region', { name: 'Your details' })
    await expect(details.getByRole('link')).toHaveText([
      'Height 175 cm',
      'Weight 80 kg',
      'Age 30 years',
      'Sex Male',
      'Activity Lightly active',
      'Goal Lose 0.5 kg a week',
      'Units kg, cm',
    ])
    await checkScreen(page, 'You, with a target')

    // Adjust opens every question from the start, filled in.
    await target.getByRole('link', { name: 'Adjust target' }).click()
    await expect(page.getByLabel('Age')).toHaveValue('30')
    await checkScreen(page, 'age, adjusting')
    await page.goBack()

    // A detail's row opens just its question, filled in.
    await details.getByRole('link', { name: 'Weight 80 kg' }).click()
    await expect(page).toHaveURL('/start/weight')
    await page.getByLabel('Weight').fill('78')
    await continueButton(page).click()
    await continueButton(page).click()
    await continueButton(page).click()
    await page.getByRole('button', { name: 'See my daily target' }).click()
    // The new target, read from the screen rather than worked out again here.
    const summary = await page.getByRole('region', { name: 'Daily target' }).textContent()
    const kcal = summary?.match(/Calories a day([\d,]+)kcal/)?.[1]
    expect(kcal).toMatch(/^[\d,]+$/)
    expect(kcal).not.toBe('2,176')
    await checkScreen(page, 'daily target, adjusting')
    await page.getByRole('button', { name: 'Save my target' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('region', { name: 'Calories and macros' })).toContainText(`${kcal}kcal left`)
    const { data } = await apiClient(user.session.access_token).from('profiles').select('weight_kg').single()
    expect(data).toEqual({ weight_kg: 78 })
    expect(await cspViolations(page)).toEqual([])
  })

  test(`when the target can't load, the You screen says so in the target card and tries again, ${theme} theme`, async ({
    page,
  }) => {
    const user = await createTestUser(`target-offline-${theme}`)
    await saveTestProfile(user.session.access_token)
    await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
    // Reading the profile fails, as it does offline, until the connection comes back.
    let online = false
    await page.route(
      (url) => url.pathname === '/rest/v1/profiles',
      (route) => (online ? route.continue() : route.abort('internetdisconnected')),
    )
    await signInAs(page, user.session)
    await page.goto('/you')

    const target = page.getByRole('region', { name: 'Daily target' })
    // supabase-js tries a failed read three more times, 1, 2 and 4 seconds apart, before giving up.
    await expect(target.getByRole('alert')).toHaveText(
      "We couldn't load your target. Check your connection and try again.",
      { timeout: 15_000 },
    )
    await checkScreen(page, 'You, target not loaded')
    online = true
    await target.getByRole('button', { name: 'Try again' }).click()
    await expect(target).toContainText('2,176kcal')
    await expect(page.getByRole('region', { name: 'Your details' })).toBeVisible()
  })
}
