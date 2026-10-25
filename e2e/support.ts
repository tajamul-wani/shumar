import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { createClient, type Session } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

// End-to-end tests run against the local Supabase stack only. playwright.config.ts
// reads its address and publishable key from `supabase status`.

export const USERS_FILE = 'e2e/.auth/users.json'

/** Every signed-in screen, by address, a name for test titles, and its main heading. */
export const SCREENS = [
  { path: '/', title: 'Today', heading: 'Today' },
  { path: '/trends', title: 'Trends', heading: 'Trends' },
  { path: '/you', title: 'You', heading: 'You' },
  { path: '/log', title: 'Add food', heading: 'Add food' },
  { path: '/sources', title: 'Food sources', heading: 'Where food values come from' },
  { path: '/privacy', title: 'Privacy policy', heading: 'Privacy policy' },
] as const

/** The signed-out screens, with the answers that let each question open directly. */
export const FIRST_RUN_SCREENS = [
  { path: '/', title: 'Home', heading: 'Your daily tally, built for Kashmiri food.' },
  { path: '/sources', title: 'Food sources', heading: 'Where food values come from' },
  { path: '/privacy', title: 'Privacy policy', heading: 'Privacy policy' },
  { path: '/start/age', title: 'Age', heading: 'How old are you?' },
  { path: '/start/sex', title: 'Sex', heading: 'What is your sex?' },
  { path: '/start/weight', title: 'Weight', heading: 'What do you weigh?' },
  { path: '/start/height', title: 'Height', heading: 'How tall are you?' },
  { path: '/start/activity', title: 'Activity', heading: 'How active are you on most days?' },
  { path: '/start/goal', title: 'Goal', heading: 'What is your goal?' },
  { path: '/start/target', title: 'Daily target', heading: 'Your daily target' },
] as const

export const FIRST_RUN_ANSWERS = {
  ageYears: 30,
  sex: 'male',
  weightKg: 80,
  weightUnit: 'kg',
  heightCm: 175,
  activity: 'light',
  goal: { kind: 'lose', kgPerWeek: 0.5 },
}

export interface TestUser {
  email: string
  session: Session
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set. Run the tests with npm run test:e2e.`)
  return value
}

export const supabaseUrl = () => required('E2E_SUPABASE_URL')
export const supabaseKey = () => required('E2E_SUPABASE_KEY')

/** A Supabase client for the test itself, acting as a signed-in user when given their token. */
export function apiClient(accessToken?: string) {
  return createClient(supabaseUrl(), supabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(accessToken ? { accessToken: async () => accessToken } : {}),
  })
}

/** Signs up a fresh user on the local stack. Each run gets new ones, so runs never share state. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `e2e-${label}-${randomUUID()}@example.com`
  const { data, error } = await apiClient().auth.signUp({ email, password: randomUUID() })
  if (error || !data.session) {
    throw new Error(`Could not create the ${label} test user: ${error?.message ?? 'no session returned'}`)
  }
  return { email, session: data.session }
}

export function readTestUsers(): { a: TestUser; b: TestUser } {
  return JSON.parse(readFileSync(USERS_FILE, 'utf8'))
}

/** Where supabase-js keeps the session in the browser for this project. */
export function sessionStorageKey(): string {
  return `sb-${new URL(supabaseUrl()).hostname.split('.')[0]}-auth-token`
}

/** Starts the page already signed in, the same way the app restores a session after a reload. */
export async function signInAs(page: Page, session: Session): Promise<void> {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [sessionStorageKey(), JSON.stringify(session)],
  )
}

/** Records every Content Security Policy violation on the page. */
export async function watchCsp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = []
    Object.assign(window, { cspViolations: seen })
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} blocked ${event.blockedURI}`)
    })
  })
}

export function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)
}

/** Serious and critical accessibility problems on the page as it is now. */
export async function accessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

// Every width the UI skill asks for, plus 1023 and 1024 px on each side of the side navigation,
// and a phone held sideways.
export const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1023, height: 768 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 844, height: 390 },
] as const

export const THEMES = ['dark', 'light'] as const

/** Starts the page in a theme, the way the You screen's Appearance choice is remembered. */
export async function useTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
}

/**
 * Text blocks whose last line holds a single word, although the text wraps (shumar-no-orphans).
 * Headings, buttons, links shown as blocks, labels and paragraphs count; text that runs inline
 * inside a paragraph is judged with the paragraph. A non-breaking space keeps two words as one.
 */
export async function loneWords(page: Page): Promise<string[]> {
  // Measure with the real typeface. Until Manrope has loaded the page is drawn in a wider fallback
  // font, where lines break in different places, and a CI runner can still be loading it when the
  // first screen is measured.
  await page.evaluate(() => document.fonts.ready)
  if (!(await page.evaluate(() => document.fonts.check('16px Manrope')))) {
    throw new Error('Manrope has not loaded, so the lines cannot be measured')
  }
  return page.evaluate(() => {
    const found = new Set<string>()
    const blocks = document.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, button, a, label, summary, p, li, dt, dd, th, td',
    )
    for (const block of blocks) {
      const style = getComputedStyle(block)
      if (style.display === 'inline' || style.visibility === 'hidden') continue
      const box = block.getBoundingClientRect()
      if (box.width <= 1 || box.height <= 1) continue
      const words: { top: number; bottom: number }[] = []
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? ''
        const pattern = /[^ \t\n\r]+/g
        for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
          const range = document.createRange()
          range.setStart(node, match.index)
          range.setEnd(node, match.index + match[0].length)
          const rect = range.getClientRects()[0]
          if (rect && rect.width > 0) words.push({ top: rect.top, bottom: rect.bottom })
        }
      }
      if (words.length < 3) continue
      // Words on one line overlap vertically, whatever their size; the next line starts below them.
      const lines: { top: number; bottom: number; count: number }[] = []
      for (const word of words.sort((a, b) => a.top - b.top)) {
        const line = lines.at(-1)
        if (line && word.top < line.bottom && word.bottom > line.top) {
          line.count += 1
          line.top = Math.min(line.top, word.top)
          line.bottom = Math.max(line.bottom, word.bottom)
        } else lines.push({ top: word.top, bottom: word.bottom, count: 1 })
      }
      if (lines.length > 1 && lines[lines.length - 1].count === 1) {
        found.add((block.textContent ?? '').replace(/\s+/g, ' ').trim())
      }
    }
    return [...found]
  })
}

export function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
}

/** Saves FIRST_RUN_ANSWERS as the user's profile: a target of 2,176 kcal, 128 g protein, 280 g carbs, 60 g fat. */
export async function saveTestProfile(accessToken: string): Promise<void> {
  const answers = FIRST_RUN_ANSWERS
  const { error } = await apiClient(accessToken).from('profiles').insert({
    age_years: answers.ageYears,
    sex: answers.sex,
    weight_kg: answers.weightKg,
    weight_unit: answers.weightUnit,
    height_cm: answers.heightCm,
    activity: answers.activity,
    goal: answers.goal.kind,
    loss_kg_per_week: answers.goal.kgPerWeek,
  })
  if (error) throw new Error(`Could not save the test profile: ${error.message}`)
}

/** Fails on any serious accessibility problem, or on sideways scrolling at 320 px. */
export async function checkScreen(page: Page, step: string): Promise<void> {
  const blocking = await accessibilityViolations(page)
  expect(blocking, `${step}: ${JSON.stringify(blocking, null, 2)}`).toEqual([])
  const size = page.viewportSize()
  await page.setViewportSize({ width: 320, height: 640 })
  expect(await scrollsSideways(page), `${step}: sideways scroll at 320 px`).toBe(false)
  if (size) await page.setViewportSize(size)
}

/** Taps a choice's card, as a person does, and checks its radio button is now chosen. */
export async function choose(page: Page, name: string | RegExp): Promise<void> {
  const radio = page.getByRole('radio', typeof name === 'string' ? { name, exact: true } : { name })
  await page.locator('label').filter({ has: radio }).click()
  await expect(radio).toBeChecked()
}
