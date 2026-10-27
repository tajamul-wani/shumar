import { describe, expect, it, vi } from 'vitest'
import { SERVICE_WORKER_URL, registerServiceWorker } from './serviceWorker.ts'

function environment(
  readyState: DocumentReadyState,
  register = vi.fn<() => Promise<unknown>>(async () => ({})),
) {
  const listeners: (() => void)[] = []
  return {
    env: {
      navigator: { serviceWorker: { register } as unknown as ServiceWorkerContainer },
      document: { readyState },
      addEventListener: vi.fn<(type: 'load', listener: () => void, options: { once: true }) => void>(
        (_type, listener) => {
          listeners.push(listener)
        },
      ),
    },
    register,
    fireLoad: () => listeners.forEach((listener) => listener()),
  }
}

describe('registerServiceWorker', () => {
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
    registerServiceWorker({ navigator: {}, document: { readyState: 'complete' }, addEventListener })
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
})
