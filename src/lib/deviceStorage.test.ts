import { describe, expect, it } from 'vitest'
import { deviceStorage } from './deviceStorage.ts'

describe('deviceStorage', () => {
  it('gives the browser storage', () => {
    expect(deviceStorage()).toBe(globalThis.localStorage)
  })

  it('gives nothing when the browser blocks storage', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    })
    try {
      expect(deviceStorage()).toBeUndefined()
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
    }
  })
})
