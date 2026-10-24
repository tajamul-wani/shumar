import { expect, test } from '@playwright/test'
import { FIRST_RUN_ANSWERS, apiClient, createTestUser, signInAs } from './support.ts'

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
