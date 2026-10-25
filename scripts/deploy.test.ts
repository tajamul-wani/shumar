import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The Cloudflare config stays the small, safe shape the README describes: static files only,
// the app's own screens served on a refresh, and nothing a Worker would run or hold.

function readWranglerConfig(): Record<string, unknown> {
  const text = readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf8')
  const withoutComments = text.replace(/^\s*\/\/.*$/gm, '')
  const withoutTrailingCommas = withoutComments.replace(/,(\s*[}\]])/g, '$1')
  return JSON.parse(withoutTrailingCommas) as Record<string, unknown>
}

describe('the Cloudflare config', () => {
  const config = readWranglerConfig()

  it('names the Worker the way the dashboard expects and serves the build folder', () => {
    expect(config.name).toBe('shumar')
    expect(config.assets).toMatchObject({ directory: './dist' })
  })

  it('serves the app for any screen address, so a refresh or a shared link still opens it', () => {
    expect(config.assets).toMatchObject({ not_found_handling: 'single-page-application' })
  })

  it('runs no Worker code and holds no variables or secrets', () => {
    expect(config).not.toHaveProperty('main')
    expect(config).not.toHaveProperty('vars')
    expect(config).not.toHaveProperty('secrets')
    expect(config.assets).not.toHaveProperty('run_worker_first')
  })

  it('pins a compatibility date that is not in the future', () => {
    const date = config.compatibility_date
    expect(typeof date).toBe('string')
    expect(new Date(`${date as string}T00:00:00Z`).getTime()).toBeLessThanOrEqual(Date.now())
  })
})
