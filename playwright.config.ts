import { defineConfig, devices } from '@playwright/test'
import { execFileSync } from 'node:child_process'

const PORT = 4173
// An address, not "localhost": the runners map that name to both IPv4 and IPv6, so each page
// load would first resolve it and pick one. A WebKit page once waited 30 seconds there without
// any response, and with a fixed address there is nothing to resolve.
const ORIGIN = `http://127.0.0.1:${PORT}`

// The app is built against the local Supabase stack, never the hosted project.
// Vite prefers these over the values in .env.local. Workers inherit them, so this runs once.
if (!process.env.E2E_SUPABASE_URL || !process.env.E2E_SUPABASE_KEY) {
  let status: { API_URL?: string; PUBLISHABLE_KEY?: string }
  try {
    status = JSON.parse(
      execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    )
  } catch {
    throw new Error('End-to-end tests need the local Supabase stack. Start it with: npx supabase start')
  }
  if (!status.API_URL || !status.PUBLISHABLE_KEY) {
    throw new Error('supabase status did not report the local API address and publishable key.')
  }
  process.env.E2E_SUPABASE_URL = status.API_URL
  process.env.E2E_SUPABASE_KEY = status.PUBLISHABLE_KEY
}

// The layout sweep resizes one page through every width, so it only needs one browser.
const browserTests = { testIgnore: /(api|layout)\.spec\.ts/ }

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  // GitHub's runners have 4 cores, and Playwright would use only 2 by default.
  workers: process.env.CI ? 4 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: ORIGIN,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone-android', ...browserTests, use: { ...devices['Pixel 7'] } },
    { name: 'phone-iphone', ...browserTests, use: { ...devices['iPhone 14'] } },
    { name: 'tablet', ...browserTests, use: { ...devices['iPad (gen 7)'] } },
    {
      name: 'desktop',
      testIgnore: /api\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    // Data isolation is checked once, straight against the API.
    { name: 'api', testMatch: /api\.spec\.ts/ },
  ],
  webServer: {
    // Its own output folder, so a test run never replaces the real build in dist/.
    command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: ORIGIN,
    // Never reuse a server: one left running could be built against the hosted project.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: process.env.E2E_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_KEY,
    },
  },
})
