import { expect, test, type Page } from '@playwright/test'
import {
  apiClient,
  checkScreen,
  createTestUser,
  saveTestProfile,
  signInAs,
  type TestUser,
} from './support.ts'

// The week and the month from a person's own logs, and a day opened from the chart.

const pad = (n: number) => String(n).padStart(2, '0')
const key = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'long' })
const DAY_MONTH = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long' })

/** "Sunday, 25 October" in Chromium, "Sunday 25 October" in WebKit: the browser decides the comma. */
const dayHeading = (date: Date, rest = '') =>
  new RegExp(`^${WEEKDAY.format(date)},? ${DAY_MONTH.format(date)}${rest}$`)

/** Today and the day before, both in the same week (the test runner and the browser share this machine's clock). */
function recentDays() {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  // Monday is day 1 of the week, so a Monday has only itself so far.
  const daysSoFar = ((today.getDay() + 6) % 7) + 1
  return { today, yesterday, daysSoFar }
}

async function logFood(
  user: TestUser,
  date: string,
  meal: string,
  kcal: number,
  protein: number,
  sodium: number,
) {
  const { error } = await apiClient(user.session.access_token).from('user_logs').insert({
    log_date: date,
    meal,
    food_name: 'Test item',
    food_source: 'usda',
    quantity: 1,
    unit_name: 'g',
    grams: 1,
    kcal,
    protein,
    carbs: 10,
    fat: 5,
    sodium_mg: sodium,
  })
  expect(error).toBeNull()
}

async function openTrends(page: Page, user: TestUser, theme: 'dark' | 'light') {
  await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
  await signInAs(page, user.session)
  await page.goto('/trends')
  await expect(page.getByRole('heading', { level: 1, name: 'Trends' })).toBeVisible()
}

for (const theme of ['dark', 'light'] as const) {
  test(`the week shows each day against the target, and a bar opens the day, ${theme} theme`, async ({
    page,
  }) => {
    const user = await createTestUser(`trends-${theme}`)
    await saveTestProfile(user.session.access_token)
    const { today, yesterday, daysSoFar } = recentDays()
    await logFood(user, key(today), 'breakfast', 2000, 60, 900)
    await logFood(user, key(today), 'dinner', 500, 40, 1300)
    const sameWeek = yesterday.getDay() !== 0 // a Sunday belongs to the week before
    if (sameWeek) await logFood(user, key(yesterday), 'lunch', 1500, 50, 400)

    await openTrends(page, user, theme)
    await expect(page.getByRole('button', { name: 'Week', pressed: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Later week' })).toBeDisabled()
    await checkScreen(page, 'trends, week')

    const calories = page.getByRole('region', { name: 'Calories' })
    const todayBar = calories.getByRole('link', {
      name: dayHeading(today, ': 2,500 kcal, over target\\. Open the day'),
    })
    await expect(todayBar).toBeVisible()
    const logged = sameWeek ? 2 : 1
    await expect(calories).toContainText(`Days over target1 of ${logged}`)
    await expect(calories).toContainText(`Days logged${logged} of ${daysSoFar}`)
    await expect(calories).toContainText(
      sameWeek ? '2,000kcal a day on average' : '2,500kcal a day on average',
    )
    const macros = page.getByRole('region', { name: 'Protein, carbs and fat' })
    await expect(macros).toContainText(sameWeek ? 'Protein75 / 128 g' : 'Protein100 / 128 g')
    await expect(page.getByRole('region', { name: 'This week' })).toContainText('kcal')

    await todayBar.click()
    await expect(page.getByRole('heading', { level: 1, name: dayHeading(today) })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Calories and macros' })).toContainText('324kcal over')
    const targets = page.getByRole('region', { name: 'Against the targets' })
    await expect(targets).toContainText('Protein28 g short')
    await expect(targets).toContainText('Carbs260 g short')
    const sodium = page.getByRole('region', { name: 'Sodium' })
    await expect(sodium).toContainText('2,200 / 2,000 mg')
    await expect(sodium).toContainText("Over the day's limit. Most of it came from Test item.")
    await expect(page.getByRole('heading', { level: 2, name: 'Meals' })).toBeVisible()
    await expect(page.getByRole('article', { name: 'Breakfast' })).toContainText('Test item')
    // A past day is read only: its foods don't open to be changed or removed.
    await expect(page.getByRole('link', { name: /change or remove/ })).toHaveCount(0)
    await checkScreen(page, 'a day from the chart')

    await page.getByRole('link', { name: 'Trends' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Trends' })).toBeVisible()
  })
}

test('the month view and moving between ranges', async ({ page }) => {
  const user = await createTestUser('trends-month')
  await saveTestProfile(user.session.access_token)
  const { today } = recentDays()
  await logFood(user, key(today), 'lunch', 1800, 90, 300)
  await openTrends(page, user, 'dark')

  await page.getByRole('button', { name: 'Month' }).click()
  await expect(page.getByRole('button', { name: 'Month', pressed: true })).toBeVisible()
  const monthName = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(today)
  await expect(page.getByText(monthName)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Calories' })).toContainText(
    `Days logged1 of ${today.getDate()}`,
  )
  await expect(page.getByRole('region', { name: `${monthName.split(' ')[0]} so far` })).toBeVisible()
  await checkScreen(page, 'trends, month')

  await page.getByRole('button', { name: 'Earlier month' }).click()
  await expect(page.getByRole('button', { name: 'Later month' })).toBeEnabled()
  await expect(page.getByRole('region', { name: 'Calories' })).toContainText('Nothing logged on these days.')
  await page.getByRole('button', { name: 'Later month' }).click()
  await expect(page.getByRole('button', { name: 'Later month' })).toBeDisabled()

  await page.getByRole('button', { name: 'Week' }).click()
  await page.getByRole('button', { name: 'Earlier week' }).click()
  await expect(page.getByRole('region', { name: 'That week' })).toBeVisible()
})

test('a day address that is not a date goes back to Trends, and a day with nothing says so', async ({
  page,
}) => {
  const user = await createTestUser('trends-empty')
  await signInAs(page, user.session)
  await page.goto('/trends/day/not-a-date')
  await expect(page).toHaveURL('/trends')
  await page.goto('/trends/day/2026-10-01')
  await expect(page.getByText('Nothing was logged on this day.')).toBeVisible()
})
