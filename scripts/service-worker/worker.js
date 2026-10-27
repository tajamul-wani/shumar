// Shumār's service worker. The build puts VERSION and PRECACHE in front of this file and writes
// the result to /sw.js (scripts/service-worker/build.ts).
//
// It keeps this version's own files (the page, its scripts, styles, fonts and icons) so the app
// opens without a connection, and nothing else. It never answers a request for another site, so
// Supabase, sign-in and every person's data go straight to the network as if there were no worker,
// and none of it is ever stored here.
/* global VERSION, PRECACHE */

const CACHE = `shumar-${VERSION}`
/** Every screen is the same page: the app picks the screen from the address. */
const SHELL = '/'

/**
 * Files under /assets/ carry a hash of their content in their name, so the browser's own copy is
 * always right and an unchanged file is not downloaded again. Every other file (the page, the
 * icons, the manifest) is fetched fresh, skipping that cache.
 */
function fresh(path) {
  return new Request(path, { cache: path.startsWith('/assets/') ? 'default' : 'reload' })
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map(fresh))))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('shumar-') && name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      // The page that installed the worker comes under it at once, so it already works offline.
      .then(() => self.clients.claim()),
  )
})

// A new version waits until the person chooses to refresh, so a page never mixes two versions.
// Only this site's own pages may ask; a message from anywhere else is ignored.
self.addEventListener('message', (event) => {
  if (event.origin !== self.location.origin) return
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

/**
 * How to answer a request: 'shell' for a screen of the app, 'kept' for one of this version's
 * files, or null to leave it to the network untouched.
 */
function plan(request) {
  if (request.method !== 'GET') return null
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return null
  if (request.mode === 'navigate') {
    const last = url.pathname.split('/').pop() ?? ''
    return last.includes('.') ? null : 'shell'
  }
  return PRECACHE.includes(url.pathname) ? 'kept' : null
}

self.addEventListener('fetch', (event) => {
  const how = plan(event.request)
  if (!how) return
  const key = how === 'shell' ? SHELL : new URL(event.request.url).pathname
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(key))
      .then((kept) => kept || fetch(event.request)),
  )
})
