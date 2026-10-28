// The web app manifest: what a phone or computer needs to install Shumār and open it in a window
// of its own. The build writes it from the site's own words and colors, so it never drifts from
// the page.
import { SITE_DESCRIPTION, SITE_NAME } from '../src/shell/site.ts'

export const MANIFEST_PATH = '/manifest.webmanifest'

/** The icons drawn by `npm run brand` (SHU-29): the hexagon, and a maskable version that stays in Android's safe zone. */
export const MANIFEST_ICONS = [
  { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]

/**
 * The dark theme's page color from src/index.css, the default theme's base color: what the
 * phone paints behind the app while it opens.
 */
export function darkBaseColor(indexCss: string): string {
  const color = /--koshur-base:\s*(#[0-9a-f]{6})\s*;/i.exec(indexCss)?.[1]
  if (!color) throw new Error('src/index.css has no --koshur-base color for the manifest.')
  return color.toUpperCase()
}

/**
 * Pictures of the app for the browser's install sheet: on Android, Chrome shows a fuller sheet
 * with these instead of a one-line prompt. Taken from the real app with foods and amounts from
 * USDA FoodData Central. Phones get the narrow ones, computers the wide one.
 */
export const MANIFEST_SCREENSHOTS = [
  {
    src: '/screens/today.png',
    sizes: '780x1688',
    type: 'image/png',
    form_factor: 'narrow',
    label: "Today: the day's calories, protein, carbs and fat",
  },
  {
    src: '/screens/trends.png',
    sizes: '780x1688',
    type: 'image/png',
    form_factor: 'narrow',
    label: "Trends: the week's calories against the daily target",
  },
  {
    src: '/screens/you.png',
    sizes: '780x1688',
    type: 'image/png',
    form_factor: 'narrow',
    label: 'You: the daily target and the details it comes from',
  },
  {
    src: '/screens/today-wide.png',
    sizes: '1440x900',
    type: 'image/png',
    form_factor: 'wide',
    label: 'Today on a computer, with every meal and its foods',
  },
]

export function webManifest(baseColor: string) {
  return {
    id: '/',
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: 'en',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: baseColor,
    theme_color: baseColor,
    categories: ['health', 'food'],
    icons: MANIFEST_ICONS,
    screenshots: MANIFEST_SCREENSHOTS,
  }
}
