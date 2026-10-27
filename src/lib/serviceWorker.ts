/**
 * Registers the service worker (public file /sw.js, written by the build), which keeps the app's
 * own files so it opens without a connection. Only in a built app: the dev server has no worker,
 * so what it shows is always the code being written.
 */
export const SERVICE_WORKER_URL = '/sw.js'

interface Environment {
  navigator: Pick<Navigator, 'serviceWorker'> | Record<string, never>
  document: Pick<Document, 'readyState'>
  addEventListener: (type: 'load', listener: () => void, options: { once: true }) => void
}

/** Starts registering after the page has loaded, so the first visit's own downloads come first. */
export function registerServiceWorker(env: Environment = window): void {
  if (!('serviceWorker' in env.navigator) || !env.navigator.serviceWorker) return
  const container = env.navigator.serviceWorker
  // A browser that refuses (a private window, or storage turned off) simply has no offline copy.
  const register = () => void container.register(SERVICE_WORKER_URL, { scope: '/' }).catch(() => undefined)
  if (env.document.readyState === 'complete') register()
  else env.addEventListener('load', register, { once: true })
}
