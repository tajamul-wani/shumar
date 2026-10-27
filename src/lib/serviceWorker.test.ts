import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SERVICE_WORKER_URL,
  applyUpdate,
  onUpdateReady,
  registerServiceWorker,
  resetUpdates,
  watchForUpdates,
} from './serviceWorker.ts'

/** Something events can be listened to and fired on. */
function target<T extends object>(fields: T) {
  const handlers = new Map<string, (() => void)[]>()
  return Object.assign(fields, {
    addEventListener: vi.fn<(type: string, handler: () => void) => void>((type, handler) => {
      handlers.set(type, [...(handlers.get(type) ?? []), handler])
    }),
    fire: (type: string) => (handlers.get(type) ?? []).forEach((handler) => handler()),
  })
}

function fakeWorker(state = 'installed') {
  return target({ state, postMessage: vi.fn<(message: unknown) => void>() })
}

function fakeRegistration(waitingWorker: ReturnType<typeof fakeWorker> | null = null) {
  return target({
    waiting: waitingWorker as unknown as ServiceWorker | null,
    installing: null as ReturnType<typeof fakeWorker> | null,
    update: vi.fn<() => Promise<void>>(async () => undefined),
  })
}

function fakeDocument(readyState: DocumentReadyState = 'complete') {
  return target({ readyState, visibilityState: 'visible' as DocumentVisibilityState })
}

const asRegistration = (registration: ReturnType<typeof fakeRegistration>) =>
  registration as unknown as ServiceWorkerRegistration

afterEach(() => resetUpdates())

describe('registerServiceWorker', () => {
  function environment(
    readyState: DocumentReadyState,
    register = vi.fn<() => Promise<unknown>>(async () => fakeRegistration()),
  ) {
    const window = target({})
    return {
      env: {
        navigator: { serviceWorker: { register, controller: null } as unknown as ServiceWorkerContainer },
        document: fakeDocument(readyState),
        addEventListener: window.addEventListener,
      },
      register,
      fireLoad: () => window.fire('load'),
    }
  }

  it('registers /sw.js for the whole site once the page has loaded', () => {
    const { env, register, fireLoad } = environment('interactive')
    registerServiceWorker(env)
    expect(register).not.toHaveBeenCalled()
    fireLoad()
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL, { scope: '/' })
  })

  it('registers at once when the page has already loaded', () => {
    const { env, register } = environment('complete')
    registerServiceWorker(env)
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('does nothing in a browser without service workers', () => {
    const addEventListener = vi.fn<() => void>()
    registerServiceWorker({ navigator: {}, document: fakeDocument(), addEventListener })
    expect(addEventListener).not.toHaveBeenCalled()
  })

  it('carries on quietly when the browser refuses', async () => {
    const register = vi.fn<() => Promise<unknown>>(async () => {
      throw new Error('blocked')
    })
    const { env } = environment('complete', register)
    expect(() => registerServiceWorker(env)).not.toThrow()
    await Promise.resolve()
    expect(register).toHaveBeenCalled()
  })

  it('watches the registration it gets for a new version', async () => {
    const next = fakeWorker()
    const { env } = environment(
      'complete',
      vi.fn<() => Promise<unknown>>(async () => fakeRegistration(next)),
    )
    Object.assign(env.navigator.serviceWorker, { controller: fakeWorker('activated') })
    const ready = vi.fn<() => void>()
    onUpdateReady(ready)
    registerServiceWorker(env)
    await vi.waitFor(() => expect(ready).toHaveBeenCalled())
  })
})

describe('watchForUpdates', () => {
  const running = () => fakeWorker('activated') as unknown as ServiceWorker

  it('announces a new version already waiting, to listeners now and later', () => {
    const early = vi.fn<() => void>()
    onUpdateReady(early)
    watchForUpdates(asRegistration(fakeRegistration(fakeWorker())), {
      controller: running,
      document: fakeDocument(),
    })
    expect(early).toHaveBeenCalledTimes(1)
    const late = vi.fn<() => void>()
    onUpdateReady(late)
    expect(late).toHaveBeenCalledTimes(1)
  })

  it('announces a version once it has installed, but not the very first worker', () => {
    const ready = vi.fn<() => void>()
    onUpdateReady(ready)
    let controller: ServiceWorker | null = null
    const registration = fakeRegistration()
    watchForUpdates(asRegistration(registration), { controller: () => controller, document: fakeDocument() })

    // The first visit: a worker installs while none runs the page.
    const first = fakeWorker('installing')
    registration.installing = first
    registration.fire('updatefound')
    first.state = 'installed'
    registration.waiting = first as unknown as ServiceWorker
    first.fire('statechange')
    expect(ready).not.toHaveBeenCalled()

    // Later, with a worker running the page, a new one installs.
    controller = running()
    const next = fakeWorker('installing')
    registration.installing = next
    registration.fire('updatefound')
    next.fire('statechange')
    expect(ready).not.toHaveBeenCalled()
    next.state = 'installed'
    registration.waiting = next as unknown as ServiceWorker
    next.fire('statechange')
    expect(ready).toHaveBeenCalledTimes(1)
  })

  it('checks again when the person comes back to the app, and shows a version still waiting', () => {
    const ready = vi.fn<() => void>()
    const registration = fakeRegistration(fakeWorker())
    const document = fakeDocument()
    watchForUpdates(asRegistration(registration), { controller: running, document })
    onUpdateReady(ready)
    expect(ready).toHaveBeenCalledTimes(1)

    document.visibilityState = 'hidden'
    document.fire('visibilitychange')
    expect(registration.update).not.toHaveBeenCalled()
    document.visibilityState = 'visible'
    document.fire('visibilitychange')
    expect(registration.update).toHaveBeenCalledTimes(1)
    expect(ready).toHaveBeenCalledTimes(2)
  })

  it('stops telling a listener that has stopped listening', () => {
    const ready = vi.fn<() => void>()
    const stop = onUpdateReady(ready)
    stop()
    watchForUpdates(asRegistration(fakeRegistration(fakeWorker())), {
      controller: running,
      document: fakeDocument(),
    })
    expect(ready).not.toHaveBeenCalled()
  })
})

describe('applyUpdate', () => {
  it('asks the waiting version to take over, then reloads once it has', () => {
    const next = fakeWorker()
    watchForUpdates(asRegistration(fakeRegistration(next)), {
      controller: () => fakeWorker('activated') as unknown as ServiceWorker,
      document: fakeDocument(),
    })
    const container = target({})
    const reload = vi.fn<() => void>()
    applyUpdate({ container, reload })
    expect(next.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).not.toHaveBeenCalled()
    container.fire('controllerchange')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing when no version is waiting', () => {
    const container = target({})
    const reload = vi.fn<() => void>()
    applyUpdate({ container, reload })
    expect(container.addEventListener).not.toHaveBeenCalled()
  })
})
