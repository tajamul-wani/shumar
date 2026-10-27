import { describe, expect, it, vi } from 'vitest'
import {
  MAX_KEPT_IMAGE_BYTES,
  cacheVersion,
  keptFiles,
  serviceWorkerSource,
  type BuiltFile,
} from './build.ts'

const file = (path: string, content: string | Uint8Array = 'x'): BuiltFile => ({ path, content })

describe('keptFiles', () => {
  it('keeps the page as /, its scripts, styles, Latin fonts, manifest, theme script and small images, in order', () => {
    const kept = keptFiles([
      file('/index.html'),
      file('/assets/index-abc.js'),
      file('/assets/index-abc.css'),
      file('/assets/manrope-latin-400-normal-abc.woff2'),
      file('/assets/manrope-latin-ext-600-normal-a_b-c.woff2'),
      file('/manifest.webmanifest'),
      file('/theme-init.js'),
      file('/brand/icon-192.png', new Uint8Array(9_000)),
      file('/favicon.ico'),
    ])
    expect(kept.map((entry) => entry.path)).toEqual([
      '/',
      '/assets/index-abc.css',
      '/assets/index-abc.js',
      '/assets/manrope-latin-400-normal-abc.woff2',
      '/assets/manrope-latin-ext-600-normal-a_b-c.woff2',
      '/brand/icon-192.png',
      '/favicon.ico',
      '/manifest.webmanifest',
      '/theme-init.js',
    ])
  })

  it('leaves out crawler and server files, the worker, source maps, other alphabets, old font formats and big images', () => {
    const kept = keptFiles([
      file('/_headers'),
      file('/robots.txt'),
      file('/sitemap.xml'),
      file('/sw.js'),
      file('/brand/share-image.png'),
      file('/assets/index-abc.js.map'),
      file('/assets/manrope-latin-400-normal-abc.woff'),
      file('/assets/manrope-cyrillic-400-normal-abc.woff2'),
      file('/assets/manrope-vietnamese-400-normal-abc.woff2'),
      file('/assets/start-dark-abc.png', new Uint8Array(MAX_KEPT_IMAGE_BYTES + 1)),
    ])
    expect(kept).toEqual([])
  })
})

describe('cacheVersion', () => {
  it('stays the same for the same files and changes when any file changes', () => {
    const files = [file('/', 'page'), file('/assets/a.js', 'code')]
    expect(cacheVersion(files)).toBe(cacheVersion([file('/', 'page'), file('/assets/a.js', 'code')]))
    expect(cacheVersion(files)).not.toBe(cacheVersion([file('/', 'page'), file('/assets/a.js', 'new code')]))
    expect(cacheVersion(files)).not.toBe(cacheVersion([file('/', 'page')]))
    expect(cacheVersion(files)).toMatch(/^[0-9a-f]{16}$/)
  })
})

// ---------------------------------------------------------------------------------------------
// The worker itself, run against a stand-in for the browser.
// ---------------------------------------------------------------------------------------------

const ORIGIN = 'https://shumar.example'
const KEPT = [file('/', 'page'), file('/assets/index-abc.js', 'code'), file('/brand/icon-192.png', 'icon')]

class FakeRequest {
  url: string
  method: string
  mode: string
  cache: string
  constructor(url: string, init: { method?: string; mode?: string; cache?: string } = {}) {
    this.url = new URL(url, ORIGIN).href
    this.method = init.method ?? 'GET'
    this.mode = init.mode ?? 'cors'
    this.cache = init.cache ?? 'default'
  }
}

/** Runs /sw.js as a browser would, with its caches, network and clients faked, and records what it does. */
function runWorker(storedCaches: string[] = []) {
  const handlers: Record<string, (event: unknown) => void> = {}
  const stored = new Map<string, Map<string, string>>(storedCaches.map((name) => [name, new Map()]))
  const added: FakeRequest[] = []
  const deleted: string[] = []
  const claim = vi.fn<() => Promise<void>>(async () => undefined)
  const skipWaiting = vi.fn<() => void>()
  const network = vi.fn<(request: FakeRequest) => Promise<string>>(async (sent) => `network ${sent.url}`)
  const caches = {
    open: async (name: string) => {
      const entries = stored.get(name) ?? new Map<string, string>()
      stored.set(name, entries)
      return {
        addAll: async (requests: FakeRequest[]) => {
          added.push(...requests)
          for (const each of requests) entries.set(new URL(each.url).pathname, `kept ${each.url}`)
        },
        match: async (key: string) => entries.get(key),
      }
    },
    keys: async () => [...stored.keys()],
    delete: async (name: string) => {
      deleted.push(name)
      return stored.delete(name)
    },
  }
  const self = {
    location: new URL(ORIGIN),
    clients: { claim },
    skipWaiting,
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler
    },
  }
  new Function('self', 'caches', 'fetch', 'Request', serviceWorkerSource(KEPT))(
    self,
    caches,
    network,
    FakeRequest,
  )

  /** Fires an event and waits for what it hands to waitUntil. */
  async function lifecycle(type: 'install' | 'activate') {
    let work: Promise<unknown> = Promise.resolve()
    handlers[type]({ waitUntil: (promise: Promise<unknown>) => (work = promise) })
    await work
  }

  /** Sends a request through the worker: what it answers with, or 'not answered' when it leaves it to the network. */
  async function request(url: string, init: { method?: string; mode?: string } = {}) {
    let answer: Promise<unknown> | null = null
    handlers.fetch({
      request: new FakeRequest(url, init),
      respondWith: (promise: Promise<unknown>) => (answer = promise),
    })
    return answer === null ? 'not answered' : await answer
  }

  return { lifecycle, request, handlers, added, deleted, claim, skipWaiting, network, stored }
}

describe('the service worker', () => {
  it("keeps this version's files when it installs, fetching only the unhashed ones past the browser's cache", async () => {
    const worker = runWorker()
    await worker.lifecycle('install')
    expect(worker.added.map((sent) => [new URL(sent.url).pathname, sent.cache])).toEqual([
      ['/', 'reload'],
      ['/assets/index-abc.js', 'default'],
      ['/brand/icon-192.png', 'reload'],
    ])
  })

  it('removes older versions of its own, never another cache, and takes over the open page', async () => {
    const worker = runWorker(['shumar-old', 'someone-else'])
    await worker.lifecycle('install')
    await worker.lifecycle('activate')
    expect(worker.deleted).toEqual(['shumar-old'])
    expect([...worker.stored.keys()]).toEqual(['someone-else', `shumar-${cacheVersion(KEPT)}`])
    expect(worker.claim).toHaveBeenCalled()
  })

  it('answers every screen of the app with the kept page, and the kept files from the cache', async () => {
    const worker = runWorker()
    await worker.lifecycle('install')
    expect(await worker.request('/trends', { mode: 'navigate' })).toBe(`kept ${ORIGIN}/`)
    expect(await worker.request('/?code=abc', { mode: 'navigate' })).toBe(`kept ${ORIGIN}/`)
    expect(await worker.request('/assets/index-abc.js')).toBe(`kept ${ORIGIN}/assets/index-abc.js`)
    expect(worker.network).not.toHaveBeenCalled()
  })

  it('goes to the network when a kept file is missing', async () => {
    const worker = runWorker()
    expect(await worker.request('/you', { mode: 'navigate' })).toBe(`network ${ORIGIN}/you`)
  })

  it('never answers for Supabase, another site, a file it does not keep, an opened file, or anything but a read', async () => {
    const worker = runWorker()
    await worker.lifecycle('install')
    const answers = []
    for (const [url, init] of [
      ['https://project.supabase.co/rest/v1/user_logs?select=*', {}],
      ['https://project.supabase.co/auth/v1/token?grant_type=refresh_token', { method: 'POST' }],
      ['https://project.supabase.co/auth/v1/authorize?provider=google', { mode: 'navigate' }],
      ['https://other.example/assets/index-abc.js', {}],
      ['/assets/start-dark-abc.png', {}],
      ['/robots.txt', { mode: 'navigate' }],
      ['/assets/index-abc.js', { method: 'POST' }],
    ] as const) {
      answers.push([url, await worker.request(url, init)])
    }
    expect(answers.filter(([, answer]) => answer !== 'not answered')).toEqual([])
    expect(worker.network).not.toHaveBeenCalled()
  })

  it('moves to the new version only when the page asks', () => {
    const worker = runWorker()
    worker.handlers.message({ data: { type: 'something else' } })
    worker.handlers.message({ data: null })
    expect(worker.skipWaiting).not.toHaveBeenCalled()
    worker.handlers.message({ data: { type: 'SKIP_WAITING' } })
    expect(worker.skipWaiting).toHaveBeenCalled()
  })
})
