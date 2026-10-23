import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
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
] as const

/** The signed-out screens, with the answers that let each question open directly. */
export const FIRST_RUN_SCREENS = [
  { path: '/', title: 'Welcome', heading: 'Shumār' },
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

export function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
}
