// One-off: turns the name Shumār into an outline for the logo files, so it looks the same
// anywhere, even where our font isn't installed. HarfBuzz (the text engine Chrome and Firefox use)
// shapes the text from the same Manrope files the app serves, under the SIL Open Font License,
// which allows using it in a logo. Chromium then lays out the same text, and the widths must agree,
// so the shape is what a browser would draw.
//
// HarfBuzz isn't a project dependency. Install it once outside the project, then pass its folder:
//   npm install --prefix ~/tools/shumar-fonts --ignore-scripts harfbuzzjs@1.6.3
//   node scripts/brand/outline-text.mjs ~/tools/shumar-fonts/node_modules/harfbuzzjs
// It writes scripts/brand/text-outlines.json, which `npm run brand` reads.
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inflateSync } from 'node:zlib'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const FONTS = join(HERE, '..', '..', 'node_modules', '@fontsource')
const harfbuzzDir = process.argv[2]
if (!harfbuzzDir) {
  console.error('Pass the harfbuzzjs folder, for example ~/tools/shumar-fonts/node_modules/harfbuzzjs')
  process.exit(1)
}
const hb = await import(pathToFileURL(join(harfbuzzDir, 'dist', 'index.mjs')).href)

// The name is outlined at 100 px; the logo scales it.
const NAME = { text: 'Shumār', size: 100 }
const MANROPE = {
  latin: 'manrope/files/manrope-latin-600-normal',
  'latin-ext': 'manrope/files/manrope-latin-ext-600-normal',
}

/** Unpacks a WOFF 1.0 file into the plain font (SFNT) that HarfBuzz reads. */
function sfntFromWoff(woff) {
  const tables = woff.readUInt16BE(12)
  const entries = []
  for (let i = 0; i < tables; i++) {
    const at = 44 + i * 20
    const offset = woff.readUInt32BE(at + 4)
    const compressed = woff.readUInt32BE(at + 8)
    const length = woff.readUInt32BE(at + 12)
    const raw = woff.subarray(offset, offset + compressed)
    entries.push({
      tag: woff.subarray(at, at + 4),
      checksum: woff.readUInt32BE(at + 16),
      data: compressed < length ? inflateSync(raw) : raw,
    })
  }
  let offset = 12 + tables * 16
  const head = Buffer.alloc(offset)
  head.writeUInt32BE(woff.readUInt32BE(4), 0)
  head.writeUInt16BE(tables, 4)
  const power = 2 ** Math.floor(Math.log2(tables))
  head.writeUInt16BE(power * 16, 6)
  head.writeUInt16BE(Math.log2(power), 8)
  head.writeUInt16BE(tables * 16 - power * 16, 10)
  const bodies = entries.map((entry, i) => {
    entry.tag.copy(head, 12 + i * 16)
    head.writeUInt32BE(entry.checksum, 16 + i * 16)
    head.writeUInt32BE(offset, 20 + i * 16)
    head.writeUInt32BE(entry.data.length, 24 + i * 16)
    const padded = Buffer.alloc(Math.ceil(entry.data.length / 4) * 4)
    entry.data.copy(padded)
    offset += padded.length
    return padded
  })
  return Buffer.concat([head, ...bodies])
}

function openFont(file) {
  const face = new hb.Face(new hb.Blob(sfntFromWoff(readFileSync(join(FONTS, `${file}.woff`)))))
  return { face, font: new hb.Font(face) }
}

/** Shapes text and returns its glyphs in visual order, left to right, in font units. */
function shapeRun({ font }, text) {
  const buffer = new hb.Buffer()
  buffer.addText(text)
  buffer.guessSegmentProperties()
  hb.shape(font, buffer)
  return buffer.getGlyphInfosAndPositions().map((g) => ({
    id: g.codepoint,
    advance: g.xAdvance,
    dx: g.xOffset,
    dy: g.yOffset,
  }))
}

/** Places glyphs one after another, with `spacing` font units added after each, as CSS does. */
function place(glyphs, spacing = 0, start = 0) {
  let pen = start
  const placed = glyphs.map((g) => {
    const at = { id: g.id, x: pen + g.dx, y: g.dy }
    pen += g.advance + spacing
    return at
  })
  return { placed, end: pen }
}

const round = (n) => Math.round(n * 100) / 100
/** One glyph's outline as SVG path data in px, with the baseline at y = 0 and y pointing down. */
function outline({ font, face }, glyph, size) {
  const k = size / face.upem
  const point = (x, y) => `${round((glyph.x + x) * k)} ${round(-(glyph.y + y) * k)}`
  return font
    .glyphToJson(glyph.id)
    .map(({ type, values }) => {
      if (type === 'Z') return 'Z'
      const pairs = []
      for (let i = 0; i < values.length; i += 2) pairs.push(point(values[i], values[i + 1]))
      return type + pairs.join(' ')
    })
    .join('')
}

// The name: Shum and r come from Manrope's Latin file and ā from its Latin Extended one, as in the browser.
const latin = openFont(MANROPE.latin)
const latinExt = openFont(MANROPE['latin-ext'])
let pen = 0
const namePaths = []
for (const [file, text] of [
  [latin, 'Shum'],
  [latinExt, 'ā'],
  [latin, 'r'],
]) {
  const run = place(shapeRun(file, text), 0, pen)
  for (const glyph of run.placed) namePaths.push(outline(file, glyph, NAME.size))
  pen = run.end
}

// Chromium lays out the same text: the widths must agree, so the outline is what a browser draws.
const b64 = (file) => readFileSync(join(FONTS, `${file}.woff2`)).toString('base64')
const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(`<style>
@font-face{font-family:M;src:url(data:font/woff2;base64,${b64(MANROPE.latin)}) format('woff2');font-weight:600;unicode-range:U+0000-00FF}
@font-face{font-family:M;src:url(data:font/woff2;base64,${b64(MANROPE['latin-ext'])}) format('woff2');font-weight:600;unicode-range:U+0100-024F}
body{margin:0}span{position:absolute;white-space:nowrap}
</style>
<span id="name" style="font:600 ${NAME.size}px/1 M">${NAME.text}</span>`)
await page.evaluate(() => document.fonts.ready)
const nameWidth = await page.evaluate(() => document.getElementById('name').getBoundingClientRect().width)
await browser.close()

// Chromium rounds each advance to whole pixels, so it can differ by a fraction of a pixel.
// A different font or different shaping would be off by far more.
function agree(text, width, chromiumWidth) {
  if (Math.abs(width - chromiumWidth) > 1.5) {
    throw new Error(
      `HarfBuzz makes ${text} ${width} px wide and Chromium ${chromiumWidth} px, so the outlines would not match.`,
    )
  }
}
agree(NAME.text, (pen * NAME.size) / latin.face.upem, nameWidth)

const result = {
  note: 'Made by scripts/brand/outline-text.mjs. Do not edit by hand.',
  name: { size: NAME.size, path: namePaths.join('') },
}
writeFileSync(join(HERE, 'text-outlines.json'), `${JSON.stringify(result, null, 2)}\n`)
process.stdout.write('Wrote scripts/brand/text-outlines.json.\n')
