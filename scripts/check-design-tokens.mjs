// Fails if app code uses a color, font, type size or font weight that isn't a design token.
// Tokens are defined only in src/index.css. Test files are skipped (they may hold fixture values).
// Also fails if the status bar colors, which have to be written out before the CSS loads,
// drift from the koshur-base tokens.
// Usage: node scripts/check-design-tokens.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RULES = [
  { pattern: /#[0-9a-fA-F]{3,8}\b/, message: 'raw hex color: use a color token' },
  { pattern: /\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/, message: 'raw color function: use a color token' },
  { pattern: /\b[a-z-]+-\[[^\]]+\]/, message: 'arbitrary Tailwind value: use a token' },
  {
    pattern: /\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/,
    message:
      'default Tailwind text size: use text-caption, text-body-sm, text-body, text-title, text-heading or text-display',
  },
  {
    pattern: /\bfont-(thin|extralight|light|bold|extrabold|black)\b/,
    message: 'font weight outside the scale: use font-normal, font-medium or font-semibold',
  },
  {
    pattern: /\bfont-(serif|mono)\b/,
    message: 'font outside the approved set: use font-sans',
  },
  {
    pattern: /font-family\s*:|@font-face|fonts\.googleapis/,
    message: 'font defined outside the tokens: fonts come from src/index.css',
  },
  {
    pattern: /\b(fontFamily|fontSize|fontWeight|color|background(Color)?)\s*:\s*['"`]/,
    message: 'inline style value: use token classes instead',
  },
]

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const TOKEN_FILE = join(ROOT, 'src', 'index.css')

export function findViolations(text, file = 'input') {
  const found = []
  text.split('\n').forEach((line, index) => {
    for (const { pattern, message } of RULES) {
      if (pattern.test(line)) found.push(`${file}:${index + 1}: ${message}\n    ${line.trim()}`)
    }
  })
  return found
}

function baseColor(css, theme) {
  const match = css.match(
    new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{[^}]*--koshur-base:\\s*(#[0-9a-fA-F]{6})`),
  )
  return match?.[1].toLowerCase()
}

/** Compares the hand-written status bar colors with the koshur-base tokens. */
export function findThemeColorDrift({ css, themeInit, html }) {
  const dark = baseColor(css, 'dark')
  const light = baseColor(css, 'light')
  if (!dark || !light) return ['src/index.css: koshur-base is missing for the dark or light theme']
  const found = []
  const init = themeInit.match(/theme === 'light' \? '(#[0-9a-fA-F]{6})' : '(#[0-9a-fA-F]{6})'/)
  if (init?.[1].toLowerCase() !== light || init?.[2].toLowerCase() !== dark) {
    found.push(
      `public/theme-init.js: status bar colors must be koshur-base, ${light} (light) and ${dark} (dark)`,
    )
  }
  const meta = html.match(/<meta name="theme-color" content="(#[0-9a-fA-F]{6})"/)
  if (meta?.[1].toLowerCase() !== dark) {
    found.push(`index.html: the theme-color meta must be the dark koshur-base, ${dark}`)
  }
  return found
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    if (!/\.(tsx?|css)$/.test(name) || /\.test\.tsx?$/.test(name) || path === TOKEN_FILE) return []
    return [path]
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = sourceFiles(join(ROOT, 'src')).flatMap((file) =>
    findViolations(readFileSync(file, 'utf8'), relative(ROOT, file)),
  )
  violations.push(
    ...findThemeColorDrift({
      css: readFileSync(TOKEN_FILE, 'utf8'),
      themeInit: readFileSync(join(ROOT, 'public', 'theme-init.js'), 'utf8'),
      html: readFileSync(join(ROOT, 'index.html'), 'utf8'),
    }),
  )
  if (violations.length > 0) {
    console.error(`Design token check failed (${violations.length}):\n\n${violations.join('\n')}`)
    process.exit(1)
  }
  process.stdout.write('Design token check passed: only approved tokens are used.\n')
}
