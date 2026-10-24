// Draws the logo, icons, favicons and share image into public/ from the color tokens, so they always
// match the app. Run it after changing a color token, the mark or the share line: npm run brand
import { chromium, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DAY_FILLED,
  PIXEL_FAVICONS,
  appIcon,
  favicon,
  hexagonPath,
  icoFile,
  logo,
  maskableIcon,
  palettes,
  sharePage,
  squareIcon,
  type Palette,
  type TextOutlines,
} from './brand.ts'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const PUBLIC = join(ROOT, 'public')
const { dark, light } = palettes(readFileSync(join(ROOT, 'src', 'index.css'), 'utf8'))
const text = JSON.parse(
  readFileSync(join(ROOT, 'scripts', 'brand', 'text-outlines.json'), 'utf8'),
) as TextOutlines

/** Chromium draws the SVG at exactly `size` pixels, keeping any transparent corners. */
async function png(page: Page, svg: string, size: number): Promise<Buffer> {
  await page.setViewportSize({ width: size, height: size })
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block}</style><img width="${size}" height="${size}" src="${src}">`,
  )
  await page.locator('img').evaluate((img: HTMLImageElement) => img.decode())
  return page.screenshot({ type: 'png', omitBackground: true })
}

/**
 * A favicon drawn to the pixel grid: the tile, the track and its saffron part are drawn 16 times
 * larger, each pixel takes the color that covers most of it, and the drops go in as exact blocks.
 * Edges come out hard instead of blended, so the icon stays sharp in a browser tab.
 */
async function pixelFavicon(page: Page, size: 16 | 32, p: Palette): Promise<Buffer> {
  const spec = PIXEL_FAVICONS[size]
  const path = hexagonPath(size / 2, size / 2, spec.radius, spec.corner)
  const url = await page.evaluate(
    ({ edge, outline, grid, colors, filled }) => {
      const scale = 16
      const big = document.createElement('canvas')
      big.width = big.height = edge * scale
      const g = big.getContext('2d')!
      const shape = new Path2D(outline)
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      probe.setAttribute('d', outline)
      const length = probe.getTotalLength()
      const cover = (draw: () => void) => {
        g.clearRect(0, 0, big.width, big.height)
        g.save()
        g.scale(scale, scale)
        draw()
        g.restore()
        const alpha = g.getImageData(0, 0, big.width, big.height).data
        return Array.from({ length: edge * edge }, (_, i) => {
          const [x, y] = [i % edge, Math.floor(i / edge)]
          let sum = 0
          for (let yy = 0; yy < scale; yy++) {
            for (let xx = 0; xx < scale; xx++)
              sum += alpha[((y * scale + yy) * big.width + x * scale + xx) * 4 + 3]
          }
          return sum / (scale * scale * 255)
        })
      }
      g.lineJoin = 'round'
      g.lineWidth = grid.track
      const track = cover(() => g.stroke(shape))
      const day = cover(() => {
        g.lineCap = 'round'
        g.setLineDash([filled * length, length])
        g.stroke(shape)
        g.setLineDash([])
      })
      const tile = cover(() => {
        g.beginPath()
        g.roundRect(0, 0, edge, edge, edge * 0.22)
        g.fill()
      })
      const out = document.createElement('canvas')
      out.width = out.height = edge
      const o = out.getContext('2d')!
      tile.forEach((covered, i) => {
        if (covered < 0.5) return
        o.fillStyle = day[i] >= 0.5 ? colors.saffron : track[i] >= 0.5 ? colors.border : colors.base
        o.fillRect(i % edge, Math.floor(i / edge), 1, 1)
      })
      grid.drops.forEach((blocks, m) => {
        o.fillStyle = [colors.protein, colors.carbs, colors.fat][m]
        for (const [x, y, w, h] of blocks) o.fillRect(x, y, w, h)
      })
      return out.toDataURL('image/png')
    },
    { edge: size, outline: path, grid: spec, colors: p, filled: DAY_FILLED },
  )
  return Buffer.from(url.split(',')[1], 'base64')
}

/** Manrope as @font-face rules, in the two subsets the share image's text needs. */
function manrope(): string {
  const subsets: [string, string][] = [
    ['latin', 'U+0000-00FF'],
    ['latin-ext', 'U+0100-024F'],
  ]
  return [400, 600]
    .flatMap((weight) =>
      subsets.map(([subset, range]) => {
        const file = join(
          ROOT,
          'node_modules',
          '@fontsource',
          'manrope',
          'files',
          `manrope-${subset}-${weight}-normal.woff2`,
        )
        const data = readFileSync(file).toString('base64')
        return `@font-face{font-family:Manrope;font-weight:${weight};unicode-range:${range};src:url(data:font/woff2;base64,${data}) format('woff2')}`
      }),
    )
    .join('')
}

const files: Record<string, string | Buffer> = {
  'brand/logo-on-dark.svg': logo(dark, text),
  'brand/logo-on-light.svg': logo(light, text),
}
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  files['brand/icon-192.png'] = await png(page, appIcon(dark), 192)
  files['brand/icon-512.png'] = await png(page, appIcon(dark), 512)
  files['brand/icon-maskable-512.png'] = await png(page, maskableIcon(dark), 512)
  files['apple-touch-icon.png'] = await png(page, squareIcon(dark), 180)
  const favicons = {
    16: await pixelFavicon(page, 16, dark),
    32: await pixelFavicon(page, 32, dark),
    48: await png(page, favicon(dark), 48),
  }
  for (const [size, image] of Object.entries(favicons)) files[`favicon-${size}.png`] = image
  files['favicon.ico'] = icoFile(
    Object.entries(favicons).map(([size, image]) => ({ size: Number(size), png: image })),
  )

  // The share image is laid out at 1200 × 630 and saved at twice that, for high-density screens.
  const sharp = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })
  await sharp.setContent(sharePage(dark, text, manrope()))
  await sharp.evaluate(() => document.fonts.ready)
  files['brand/share-image.png'] = await sharp.screenshot({ type: 'png' })
} finally {
  await browser.close()
}

mkdirSync(join(PUBLIC, 'brand'), { recursive: true })
for (const [name, data] of Object.entries(files)) writeFileSync(join(PUBLIC, name), data)
process.stdout.write(`Drew ${Object.keys(files).length} files into public/.\n`)
