/**
 * Registers the service worker (/sw.js, written by the build), which keeps the app's own files so
 * it opens without a connection, and tells the app when a new version is ready. Only in a built
 * app: the dev server has no worker, so what it shows is always the code being written.
 */
export const SERVICE_WORKER_URL = '/sw.js'

type Listener = () => void

/** Who wants to know that a new version is waiting: the update notice. */
const listeners = new Set<Listener>()
let waiting: ServiceWorker | null = null

/** Calls the listener now if a new version is already waiting, and whenever one is. Returns a way to stop. */
export function onUpdateReady(listener: Listener): () => void {
  listeners.add(listener)
  if (waiting) listener()
  return () => listeners.delete(listener)
}

function announce(worker: ServiceWorker) {
  waiting = worker
  for (const listener of listeners) listener()
}

interface UpdateEnvironment {
  /** The worker that runs the page now; null on the very first visit, before any worker. */
  controller: () => ServiceWorker | null
  document: Pick<Document, 'visibilityState' | 'addEventListener'>
}

/**
 * Watches a registration for a new version that has installed and waits to take over. A worker
 * that installs while no worker runs the page is the first one, not an update, so it is not
 * announced. Coming back to the app checks for a new version, as an installed app can stay open
 * for days, and announces one still waiting.
 */
export function watchForUpdates(registration: ServiceWorkerRegistration, env: UpdateEnvironment): void {
  const check = () => {
    if (registration.waiting && env.controller()) announce(registration.waiting)
  }
  check()
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed') check()
    })
  })
  env.document.addEventListener('visibilitychange', () => {
    if (env.document.visibilityState !== 'visible') return
    check()
    registration.update().catch(() => undefined)
  })
}

interface ApplyEnvironment {
  container: Pick<ServiceWorkerContainer, 'addEventListener'>
  reload: () => void
}

/** Moves to the waiting version: it takes over, then the page reloads once to use it. */
export function applyUpdate(
  env: ApplyEnvironment = { container: navigator.serviceWorker, reload: () => window.location.reload() },
): void {
  const worker = waiting
  if (!worker) return
  env.container.addEventListener('controllerchange', () => env.reload(), { once: true })
  worker.postMessage({ type: 'SKIP_WAITING' })
}

interface Environment {
  navigator: Pick<Navigator, 'serviceWorker'> | Record<string, never>
  document: Pick<Document, 'readyState' | 'visibilityState' | 'addEventListener'>
  addEventListener: (type: 'load', listener: () => void, options: { once: true }) => void
}

/** Starts registering after the page has loaded, so the first visit's own downloads come first. */
export function registerServiceWorker(env: Environment = window): void {
  if (!('serviceWorker' in env.navigator) || !env.navigator.serviceWorker) return
  const container = env.navigator.serviceWorker
  // A browser that refuses (a private window, or storage turned off) simply has no offline copy.
  const register = () =>
    void container
      .register(SERVICE_WORKER_URL, { scope: '/' })
      .then((registration) =>
        watchForUpdates(registration, { controller: () => container.controller, document: env.document }),
      )
      .catch(() => undefined)
  if (env.document.readyState === 'complete') register()
  else env.addEventListener('load', register, { once: true })
}

/** For tests: forgets a waiting version. */
export function resetUpdates(): void {
  waiting = null
  listeners.clear()
}
