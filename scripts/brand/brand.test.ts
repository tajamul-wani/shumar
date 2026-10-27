import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LOGO_SIZE } from '../../src/components/logoSizes.ts'
import {
  MARK_DROPS,
  MARK_FILLED,
  MARK_HEXAGON,
  MARK_TRACK_LENGTH,
  MARK_VIEWBOX,
} from '../../src/components/markShape.ts'
import {
  DAY_FILLED,
  HEXAGON,
  MARK_DROP_PATHS,
  MASKABLE_SCALE,
  PIXEL_FAVICONS,
  TRACK_LENGTH,
  favicon,
  hexagonPath,
  icoFile,
  logo,
  palettes,
  pathBounds,
  pngSize,
  reach,
  sharePage,
  type Palette,
  type TextOutlines,
} from './brand.ts'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const file = (path: string) => readFileSync(join(ROOT, path))
const { dark, light } = palettes(file('src/index.css').toString())
const text = JSON.parse(file('scripts/brand/text-outlines.json').toString()) as TextOutlines

const colors = (svg: string) => new Set(svg.match(/#[0-9a-fA-F]{6}\b/g))

describe('palettes', () => {
  it('reads the colors the brand uses from both token blocks', () => {
    expect(dark).toEqual({
      base: '#0c0b0a',
      border: '#2c2823',
      silk: '#f5f3ef',
      muted: '#9c9488',
      saffron: '#e08a3c',
      protein: '#3e9b68',
      carbs: '#d4a259',
      fat: '#c4683c',
    })
    expect(light).toEqual({
      base: '#f7f4ee',
      border: '#e3dbcf',
      silk: '#1c1916',
      muted: '#6b6358',
      saffron: '#a85a16',
      protein: '#2f7d52',
      carbs: '#9a6b1f',
      fat: '#a9532b',
    })
  })

  it('refuses a token file with a color missing', () => {
    const css = "[data-theme='dark'] { --koshur-base: #0c0b0a; } [data-theme='light'] { }"
    expect(() => palettes(css)).toThrow(/no dark value for --koshur-border/)
  })
})

describe('the mark', () => {
  it('starts the day at the top point and fills 72% of the track', () => {
    const [x, y] = HEXAGON.slice(1).split(/[ A]/).map(Number)
    expect(x).toBe(256)
    expect(y).toBeCloseTo(256 - reach(0).vertical, 1)
    const [dash, gap] = favicon(dark)
      .match(/stroke-dasharray="([\d.]+) ([\d.]+)"/)!
      .slice(1)
      .map(Number)
    expect(gap).toBeCloseTo(TRACK_LENGTH, 1)
    expect(dash / gap).toBeCloseTo(0.72, 3)
  })

  it("fits the app icon, and stays inside Android's safe circle on the maskable icon", () => {
    expect(reach().vertical).toBeLessThan(256)
    expect(reach().vertical * MASKABLE_SCALE).toBeLessThanOrEqual(0.4 * 512)
  })

  it('draws a hexagon of any size from its top point', () => {
    expect(hexagonPath(8, 8, 6, 1).startsWith('M8 ')).toBe(true)
  })
})

describe('the pixel favicons', () => {
  it.each([16, 32] as const)('keeps every drop inside the %i px tile', (size) => {
    for (const blocks of PIXEL_FAVICONS[size].drops) {
      for (const [x, y, w, h] of blocks) {
        expect([x, y, w, h].every(Number.isInteger)).toBe(true)
        expect(x >= 0 && y >= 0 && x + w <= size && y + h <= size).toBe(true)
      }
    }
  })
})

describe('the files in public/', () => {
  const logos: [string, Palette][] = [
    ['public/brand/logo-on-dark.svg', dark],
    ['public/brand/logo-on-light.svg', light],
  ]

  it("match what the generator draws now, so a token change can't leave them stale", () => {
    for (const [path, palette] of logos) expect(file(path).toString()).toBe(logo(palette, text))
  })

  it.each(logos)('%s uses only the color tokens of its theme', (path, palette) => {
    const allowed = new Set(Object.values(palette))
    expect([...colors(file(path).toString())].filter((c) => !allowed.has(c.toLowerCase()))).toEqual([])
  })

  it('gives the app the logo at the size it is drawn', () => {
    const [, width, height] =
      file('public/brand/logo-on-dark.svg')
        .toString()
        .match(/<svg[^>]* width="([\d.]+)" height="([\d.]+)"/) ?? []
    expect([Number(width), Number(height)]).toEqual(LOGO_SIZE)
  })

  it("gives the app the mark's shape as the generator draws it, for the loading mark", () => {
    const { vertical } = reach()
    const corner = Math.round((256 - vertical) * 100) / 100
    expect(MARK_HEXAGON).toBe(HEXAGON)
    expect(MARK_DROPS).toEqual(MARK_DROP_PATHS)
    expect(MARK_TRACK_LENGTH).toBeCloseTo(TRACK_LENGTH, 2)
    expect(MARK_FILLED).toBe(DAY_FILLED)
    expect(MARK_VIEWBOX).toBe(
      `${corner} ${corner} ${Math.round(vertical * 200) / 100} ${Math.round(vertical * 200) / 100}`,
    )
  })

  it('draws the share image page in dark-theme tokens only', () => {
    const allowed = new Set(Object.values(dark))
    const page = sharePage(dark, text, '')
    expect([...colors(page)].filter((c) => !allowed.has(c.toLowerCase()))).toEqual([])
    expect(page).toContain('A calorie and macro tracker made for Kashmiri food.')
  })

  it.each([
    ['public/favicon-16.png', 16],
    ['public/favicon-32.png', 32],
    ['public/favicon-48.png', 48],
    ['public/apple-touch-icon.png', 180],
    ['public/brand/icon-192.png', 192],
    ['public/brand/icon-512.png', 512],
    ['public/brand/icon-maskable-512.png', 512],
  ])('%s is %i px square', (path, size) => {
    expect(pngSize(file(path))).toEqual([size, size])
  })

  it('has the share image at twice the 1200 x 630 link previews expect', () => {
    expect(pngSize(file('public/brand/share-image.png'))).toEqual([2400, 1260])
  })

  it('has the favicon at 16, 32 and 48 px in favicon.ico', () => {
    const ico = file('public/favicon.ico')
    expect(ico.readUInt16LE(2)).toBe(1)
    const entries = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
      const at = 6 + 16 * i
      return pngSize(ico.subarray(ico.readUInt32LE(at + 12)))[0]
    })
    expect(entries).toEqual([16, 32, 48])
  })
})

describe('icoFile', () => {
  it('lists each image with its size and where its PNG starts', () => {
    const png = (size: number) => {
      const bytes = Buffer.alloc(24)
      Buffer.from([0x89, 0x50, 0x4e, 0x47]).copy(bytes)
      bytes.writeUInt32BE(size, 16)
      bytes.writeUInt32BE(size, 20)
      return bytes
    }
    const ico = icoFile([
      { size: 16, png: png(16) },
      { size: 256, png: png(256) },
    ])
    expect(ico.readUInt16LE(4)).toBe(2)
    expect(ico.readUInt8(6)).toBe(16)
    expect(ico.readUInt8(22)).toBe(0) // 256 is written as 0
    expect(ico.readUInt32LE(6 + 12)).toBe(38)
    expect(pngSize(ico.subarray(ico.readUInt32LE(22 + 12)))).toEqual([256, 256])
  })

  it("refuses anything that isn't a PNG", () => {
    expect(() => pngSize(Buffer.from('GIF89a and more bytes here'))).toThrow(/Not a PNG/)
  })
})

describe('pathBounds', () => {
  it('finds the box around every point of a path', () => {
    expect(pathBounds('M10 20L-5 40Q30 -2 12.5 8Z')).toEqual([-5, -2, 30, 40])
  })
})
