import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SITE_DESCRIPTION, SITE_NAME } from '../src/shell/site.ts'
import { MANIFEST_ICONS, MANIFEST_SCREENSHOTS, darkBaseColor, webManifest } from './manifest.ts'

const indexCss = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

describe('darkBaseColor', () => {
  it("reads the dark theme's page color, the first --koshur-base in the file", () => {
    expect(darkBaseColor(indexCss)).toBe('#0C0B0A')
    expect(darkBaseColor(':root { --koshur-base: #0c0b0a; } [x] { --koshur-base: #f7f4ee; }')).toBe('#0C0B0A')
  })

  it('refuses a stylesheet without one', () => {
    expect(() => darkBaseColor(':root {}')).toThrow(/--koshur-base/)
  })
})

describe('webManifest', () => {
  const manifest = webManifest('#0C0B0A')

  it("names and describes the app in the site's own words, and opens it in a window of its own", () => {
    expect(manifest).toMatchObject({
      id: '/',
      name: SITE_NAME,
      short_name: SITE_NAME,
      description: SITE_DESCRIPTION,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#0C0B0A',
      theme_color: '#0C0B0A',
    })
  })

  it('offers the app icon at both sizes and a maskable one, and every file exists', () => {
    expect(manifest.icons.map((icon) => [icon.sizes, icon.purpose])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ])
    const missing = MANIFEST_ICONS.filter((icon) => !existsSync(join(process.cwd(), 'public', icon.src)))
    expect(missing).toEqual([])
  })

  it("shows pictures of the app in the install sheet, each the size it says, in Chrome's limits", () => {
    expect(manifest.screenshots).toBe(MANIFEST_SCREENSHOTS)
    expect(MANIFEST_SCREENSHOTS.filter((shot) => shot.form_factor === 'narrow').length).toBeGreaterThan(0)
    expect(MANIFEST_SCREENSHOTS.filter((shot) => shot.form_factor === 'wide').length).toBeGreaterThan(0)
    const problems = MANIFEST_SCREENSHOTS.flatMap((shot) => {
      const png = readFileSync(join(process.cwd(), 'public', shot.src))
      const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)]
      const wrong: string[] = []
      if (`${width}x${height}` !== shot.sizes)
        wrong.push(`${shot.src} is ${width}x${height}, not ${shot.sizes}`)
      // Chrome takes 320 to 3840 px a side, the long side at most 2.3 times the short one.
      if (Math.min(width, height) < 320 || Math.max(width, height) > 3840)
        wrong.push(`${shot.src} is out of range`)
      if (Math.max(width, height) / Math.min(width, height) > 2.3)
        wrong.push(`${shot.src} is too long and thin`)
      if ((shot.form_factor === 'narrow') !== height > width)
        wrong.push(`${shot.src} has the wrong form factor`)
      return wrong
    })
    expect(problems).toEqual([])
  })
})
