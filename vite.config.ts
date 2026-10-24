import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { findSecrets } from './scripts/bundle-secrets.ts'
import { headersFile, headersFor, securityHeaders, type HeaderRule } from './scripts/security-headers.ts'
import { fillPage, noindexRules, robotsTxt, siteOrigin, sitemapXml } from './scripts/seo.ts'
import { SITE_DESCRIPTION, SITE_IMAGE_ALT, SITE_NAME, SITE_TITLE } from './src/shell/site.ts'

/** The security headers on every response, and a noindex header on the app's own screens. */
function headerRules(env: Record<string, string>): HeaderRule[] {
  return [{ path: '/*', headers: securityHeaders(env.VITE_SUPABASE_URL) }, ...noindexRules()]
}

/** Fails the build if it would ship a secret, and serves every page with its headers. */
function security(env: Record<string, string>): Plugin {
  return {
    name: 'shumar-security',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        const text = file.type === 'chunk' ? file.code : Buffer.from(file.source).toString('utf8')
        const secrets = findSecrets(text)
        if (secrets.length > 0) {
          this.error(`${file.fileName} would ship a ${secrets.join(', ')}. Remove it from the app code.`)
        }
      }
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: headersFile(headerRules(env)),
      })
    },
    configurePreviewServer(server) {
      const rules = headerRules(env)
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://localhost').pathname
        for (const [name, value] of Object.entries(headersFor(path, rules))) res.setHeader(name, value)
        next()
      })
    },
  }
}

/**
 * Fills the site's address and its own words into index.html, and writes robots.txt and
 * sitemap.xml, for search engines and link previews. A build needs SITE_URL, because its links
 * must name the real site; the dev server can do without.
 */
function site(env: Record<string, string>): Plugin {
  let origin = ''
  return {
    name: 'shumar-site',
    configResolved(config) {
      origin = config.command === 'build' || env.SITE_URL ? siteOrigin(env.SITE_URL) : 'http://localhost:5173'
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        fillPage(html, { SITE_URL: origin, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION, SITE_IMAGE_ALT }),
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(origin) })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(origin) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    security(loadEnv(mode, process.cwd(), 'VITE_')),
    site(loadEnv(mode, process.cwd(), 'SITE_')),
  ],
  // Fonts stay separate files, so the security policy can allow fonts from this site only.
  build: { assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined) },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      thresholds: {
        'src/lib/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
}))
