import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { findSecrets } from './scripts/bundle-secrets.ts'
import { headersFile, securityHeaders } from './scripts/security-headers.ts'

/** Fails the build if it would ship a secret, and serves every page with the security headers. */
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
        source: headersFile(securityHeaders(env.VITE_SUPABASE_URL)),
      })
    },
    configurePreviewServer(server) {
      const headers = securityHeaders(env.VITE_SUPABASE_URL)
      server.middlewares.use((_req, res, next) => {
        for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), security(loadEnv(mode, process.cwd(), 'VITE_'))],
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
