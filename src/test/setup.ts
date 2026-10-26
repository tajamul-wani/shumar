import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Vitest globals are off, so Testing Library can't unmount between tests on its own.
afterEach(() => cleanup())

// jsdom has no matchMedia. Tests run as a phone that asks for less motion, so rings and numbers
// settle at once and what a test reads is final. A test that needs another screen stubs it again.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
})

afterEach(() => vi.unstubAllGlobals())
