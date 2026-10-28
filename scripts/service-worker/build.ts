// Writes /sw.js at build time: the worker in worker.js, with this build's version and the list of
// files to keep for offline use in front of it.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SERVICE_WORKER_PATH = '/sw.js'

/** A file the build writes or copies, by its path in the site. */
export interface BuiltFile {
  path: string
  content: Uint8Array | string
}

/** Images bigger than this stay online only, such as the home page's screenshots. */
export const MAX_KEPT_IMAGE_BYTES = 100_000

/**
 * Files for crawlers, link previews, Cloudflare or the worker itself, never shown by the app. The
 * pictures in /screens/ are for the browser's install sheet only, so they stay online too.
 */
const NEVER_KEPT = new Set([
  '/_headers',
  '/robots.txt',
  '/sitemap.xml',
  '/brand/share-image.png',
  SERVICE_WORKER_PATH,
])

/**
 * The font files the app's own words need: Manrope's Latin and extended Latin (for the ā in
 * Shumār). Browsers fetch the other alphabets only for text in them, which the app has none of.
 */
const KEPT_FONT = /-latin(-ext)?-\d{3}-normal-[\w-]+\.woff2$/

function size(content: Uint8Array | string): number {
  return typeof content === 'string' ? Buffer.byteLength(content) : content.byteLength
}

/**
 * The files to keep for offline use: the page (as /), its scripts and styles, the Latin woff2
 * fonts (every browser that can install the app reads woff2, so the older woff copies stay online),
 * the manifest, the theme script, and the icons and small images.
 */
export function keptFiles(files: readonly BuiltFile[]): BuiltFile[] {
  return files
    .filter(({ path, content }) => {
      if (NEVER_KEPT.has(path) || path.endsWith('.map') || path.startsWith('/screens/')) return false
      if (/\.woff2?$/.test(path)) return KEPT_FONT.test(path)
      if (/\.(png|jpe?g|webp|gif|ico|svg)$/.test(path)) return size(content) <= MAX_KEPT_IMAGE_BYTES
      return /\.(html|js|css|webmanifest)$/.test(path)
    })
    .map((file) => (file.path === '/index.html' ? { ...file, path: '/' } : file))
    .sort((a, b) => a.path.localeCompare(b.path))
}

/** A short name for this build: it changes whenever any kept file changes, which is what makes browsers update. */
export function cacheVersion(files: readonly BuiltFile[]): string {
  const hash = createHash('sha256')
  for (const { path, content } of files) {
    hash.update(path)
    hash.update('\0')
    hash.update(content)
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}

// From the project root, where every build and test runs.
const WORKER = readFileSync(join(process.cwd(), 'scripts/service-worker/worker.js'), 'utf8')

/** The text of /sw.js for these kept files. */
export function serviceWorkerSource(kept: readonly BuiltFile[]): string {
  const paths = kept.map((file) => file.path)
  return `const VERSION = ${JSON.stringify(cacheVersion(kept))}\nconst PRECACHE = ${JSON.stringify(paths, null, 2)}\n\n${WORKER}`
}
