// The Shumār mark, logo and icons, drawn from the color tokens in src/index.css (approved in SHU-29).
// The mark is the day as a saffron hexagon: point up, filled 72% from the top like a progress
// ring, around the protein, carbs and fat drops. The logo sets the name Shumār beside it. `npm run
// brand` writes the files into public/.

export interface Palette {
  base: string
  border: string
  silk: string
  muted: string
  saffron: string
  protein: string
  carbs: string
  fat: string
}

/** The outline of the name, made once by outline-text.mjs. */
export interface TextOutlines {
  /** Shumār in px at `size`, baseline at y = 0. */
  name: { size: number; path: string }
}

const TOKENS: Record<keyof Palette, string> = {
  base: 'koshur-base',
  border: 'koshur-border',
  silk: 'koshur-silk',
  muted: 'koshur-muted',
  saffron: 'deficit-ring',
  protein: 'macro-protein',
  carbs: 'macro-carb',
  fat: 'macro-fat',
}

/** Reads the colors the mark, logo and share image use from the dark and light token blocks. */
export function palettes(css: string): { dark: Palette; light: Palette } {
  const read = (theme: 'dark' | 'light'): Palette => {
    const block = css.match(new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? ''
    const entries = Object.entries(TOKENS).map(([key, token]) => {
      const value = block.match(new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{6})\\b`))?.[1]
      if (!value) throw new Error(`src/index.css has no ${theme} value for --${token}.`)
      return [key, value.toLowerCase()]
    })
    return Object.fromEntries(entries) as Palette
  }
  return { dark: read('dark'), light: read('light') }
}

const round = (n: number) => Math.round(n * 100) / 100
const xy = (x: number, y: number) => `${round(x)} ${round(y)}`

/** A point-up hexagon with rounded points, as one closed path from the top point, clockwise. */
export function hexagonPath(cx: number, cy: number, radius: number, corner: number): string {
  const half = Math.PI / 3 // half of the hexagon's 120° corner
  const tangent = corner / Math.tan(half) // from a point to where its rounding starts
  const arcCentre = radius - corner / Math.sin(half)
  const at = (i: number, distance: number, along = 0) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3 // point i, clockwise from the top
    const side = a + (along > 0 ? (2 * Math.PI) / 3 : -(2 * Math.PI) / 3) // towards the next or previous point
    return [
      cx + distance * Math.cos(a) + Math.abs(along) * Math.cos(side),
      cy + distance * Math.sin(a) + Math.abs(along) * Math.sin(side),
    ] as const
  }
  const arc = (to: readonly [number, number]) => `A${round(corner)} ${round(corner)} 0 0 1 ${xy(...to)}`
  let d = `M${xy(...at(0, arcCentre + corner))}${arc(at(0, radius, tangent))}`
  for (let i = 1; i < 6; i++) d += `L${xy(...at(i, radius, -tangent))}${arc(at(i, radius, tangent))}`
  return `${d}L${xy(...at(0, radius, -tangent))}${arc(at(0, arcCentre + corner))}Z`
}

// The mark, in a 512 grid centred on 256.
const CENTRE = 256
const RADIUS = 186 // centre to each point of the hexagon
const CORNER = 36 // rounding of each point
const TRACK = 44 // width of the track; the favicon uses 70 so it holds up at 48 px
const FILLED = 0.72 // the share of the day's track that is saffron

export const HEXAGON = hexagonPath(CENTRE, CENTRE, RADIUS, CORNER)
/** Six straight sides and six rounded points. */
export const TRACK_LENGTH = 6 * (RADIUS - (2 * CORNER) / Math.tan(Math.PI / 3)) + 6 * CORNER * (Math.PI / 3)
/** How far the mark reaches from the centre, up and down (the points) and sideways (the flat sides). */
export function reach(track = TRACK): { vertical: number; sideways: number } {
  const arcCentre = RADIUS - CORNER / Math.sin(Math.PI / 3)
  return { vertical: arcCentre + CORNER + track / 2, sideways: RADIUS * Math.cos(Math.PI / 6) + track / 2 }
}

// The drops: a circle with a point on top.
function dropPath(cx: number, cy: number, s: number): string {
  const p = (dx: number, dy: number) => xy(cx + dx * s, cy + dy * s)
  return `M${p(0, -1.7)}C${p(0.35, -1.25)} ${p(1, -0.65)} ${p(1, 0)}A${round(s)} ${round(s)} 0 0 1 ${p(-1, 0)}C${p(-1, -0.65)} ${p(-0.35, -1.25)} ${p(0, -1.7)}Z`
}
const macroColors = (p: Palette) => [p.protein, p.carbs, p.fat]
// The mark's drops, placed as in the approved design: protein on top, carbs lower left, fat lower right.
const MARK_DROPS: [number, number][] = [
  [-0.81, -33.75],
  [-23.76, 19.71],
  [24.57, 14.04],
]

/** The mark's shapes in the 512 grid: the dim track, its saffron part and the three drops. */
export function mark(p: Palette, track = TRACK): string {
  const dash = round(FILLED * TRACK_LENGTH)
  return [
    `<path d="${HEXAGON}" fill="none" stroke="${p.border}" stroke-width="${track}" stroke-linejoin="round"/>`,
    `<path d="${HEXAGON}" fill="none" stroke="${p.saffron}" stroke-width="${track}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dash} ${round(TRACK_LENGTH)}"/>`,
    ...MARK_DROPS.map(
      ([x, y], i) =>
        `<path d="${dropPath(CENTRE + 1.75 * x, 276 + 1.75 * y, 36.75)}" fill="${macroColors(p)[i]}"/>`,
    ),
  ].join('')
}

const svg = (viewBox: string, body: string, size?: [number, number]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${size ? ` width="${size[0]}" height="${size[1]}"` : ''}>${body}</svg>\n`

/** The installed app's icon: the mark on a rounded tile, as browsers and desktops show it. */
export const appIcon = (p: Palette) =>
  svg('0 0 512 512', `<rect width="512" height="512" rx="115.2" fill="${p.base}"/>${mark(p)}`)
/** The full square icon that iPhones round off themselves. */
export const squareIcon = (p: Palette) =>
  svg('0 0 512 512', `<rect width="512" height="512" fill="${p.base}"/>${mark(p)}`)
/** Android's maskable icon: the mark at 80% so every launcher shape leaves it whole. */
export const MASKABLE_SCALE = 0.8
export const maskableIcon = (p: Palette) => {
  const offset = round((512 * (1 - MASKABLE_SCALE)) / 2)
  return svg(
    '0 0 512 512',
    `<rect width="512" height="512" fill="${p.base}"/><g transform="translate(${offset} ${offset}) scale(${MASKABLE_SCALE})">${mark(p)}</g>`,
  )
}
/** The 48 px favicon: the mark alone on a clear background, with a thicker track so the hexagon reads at that size. */
export const favicon = (p: Palette) => svg('0 0 512 512', mark(p, 70))

/**
 * The 16 and 32 px favicons are drawn to the pixel grid, so they stay sharp in a browser tab: the
 * hexagon (radius and track in pixels), then the drops as exact blocks of pixels [x, y, w, h]. At
 * 16 px each drop is a 2×2 dot; at 32 px each is a point and a body.
 */
export const PIXEL_FAVICONS: Record<
  16 | 32,
  { radius: number; track: number; corner: number; drops: number[][][] }
> = {
  16: { radius: 6.1, track: 2, corner: 1, drops: [[[7, 5, 2, 2]], [[5, 8, 2, 2]], [[9, 8, 2, 2]]] },
  32: {
    radius: 12.6,
    track: 3.4,
    corner: 2,
    drops: [
      [
        [15, 10, 2, 1],
        [14, 11, 4, 3],
      ],
      [
        [11, 16, 2, 1],
        [10, 17, 4, 3],
      ],
      [
        [19, 16, 2, 1],
        [18, 17, 4, 3],
      ],
    ],
  },
}
/** The share of the hexagon track drawn in saffron, for the pixel favicons too. */
export const DAY_FILLED = FILLED

/** The smallest box around every point of a path: corners and control points alike. */
export function pathBounds(d: string): [number, number, number, number] {
  const n = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number)
  const xs = n.filter((_, i) => i % 2 === 0)
  const ys = n.filter((_, i) => i % 2 === 1)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

// The logo, in the mark's 512 grid: the name to the right of the hexagon, as apps like Sentry and
// Linear set theirs. The name's height is a share of the hexagon's, with a gap between them of a
// share of the same, and it is centred on the hexagon's middle.
const LOGO = { name: 0.5, gap: 0.2, margin: 10 }

/** The logo as one self-contained SVG, for a dark or a light background. */
export function logo(p: Palette, text: TextOutlines): string {
  const r = reach()
  const height = 2 * r.vertical
  const name = pathBounds(text.name.path)
  const k = (LOGO.name * height) / (name[3] - name[1])
  const left = CENTRE + r.sideways + LOGO.gap * height
  const top = CENTRE - ((name[3] - name[1]) * k) / 2
  const body =
    mark(p) +
    `<path transform="translate(${xy(left - name[0] * k, top - name[1] * k)}) scale(${round(k * 10000) / 10000})" fill="${p.silk}" d="${text.name.path}"/>`
  const m = LOGO.margin
  const view = [
    CENTRE - r.sideways - m,
    CENTRE - r.vertical - m,
    r.sideways + LOGO.gap * height + (name[2] - name[0]) * k + 2 * m + r.sideways,
    height + 2 * m,
  ].map(round)
  return svg(view.join(' '), body, [round(view[2] / 2), round(view[3] / 2)])
}

/** The line under the logo on the share image. */
export const SHARE_LINE = 'A calorie and macro tracker made for Kashmiri food.'

/**
 * The page Chromium turns into the image that link previews show: the logo, with one line about
 * the app under it at the 40 px display size, both centred. `fonts` is Manrope's @font-face CSS.
 * It is drawn at 1200 × 630 and saved at twice that, so it stays sharp on high-density screens.
 */
export function sharePage(p: Palette, text: TextOutlines, fonts: string): string {
  const [, , w, h] = logo(p, text)
    .match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/)!
    .slice(1)
    .map(Number)
  const height = 200
  return `<!doctype html><meta charset="utf-8"><style>${fonts}
body{margin:0;width:1200px;height:630px;overflow:hidden;background:${p.base};color:${p.silk};font-family:Manrope;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px}
.line{margin:0;font-size:40px;line-height:48px;font-weight:500;color:${p.muted}}
</style><img width="${round((height * w) / h)}" height="${height}" src="data:image/svg+xml;base64,${Buffer.from(logo(p, text)).toString('base64')}"><p class="line">${SHARE_LINE}</p>`
}

/** A Windows icon file holding PNG images, which every current browser reads. */
export function icoFile(images: { size: number; png: Uint8Array }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(1, 2) // an icon
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i
    header.writeUInt8(size % 256, entry) // 0 means 256
    header.writeUInt8(size % 256, entry + 1)
    header.writeUInt16LE(1, entry + 4) // colour planes
    header.writeUInt16LE(32, entry + 6) // bits per pixel
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map(({ png }) => Buffer.from(png))])
}

/** A PNG's width and height, from its header. */
export function pngSize(png: Uint8Array): [number, number] {
  const view = Buffer.from(png)
  if (view.toString('latin1', 1, 4) !== 'PNG') throw new Error('Not a PNG file.')
  return [view.readUInt32BE(16), view.readUInt32BE(20)]
}
