import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PREFERENCES,
  PREFERENCE_LABELS,
  THEME_STORAGE_KEY,
  applyTheme,
  nextPreference,
  parsePreference,
  readPreference,
  resolveTheme,
  savePreference,
  systemPrefersLight,
  watchSystemTheme,
} from './theme.ts'

function fakeWindow(prefersLight: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const query = {
    matches: prefersLight,
    addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => listeners.delete(fn),
  }
  return {
    win: { matchMedia: () => query as unknown as MediaQueryList },
    fire: (light: boolean) => listeners.forEach((fn) => fn({ matches: light } as MediaQueryListEvent)),
    listenerCount: () => listeners.size,
  }
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

const throwingStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

afterEach(() => {
  delete document.documentElement.dataset.theme
  document.documentElement.style.removeProperty('--koshur-base')
  document.head.innerHTML = ''
})

describe('parsePreference', () => {
  it('accepts light and dark', () => {
    expect(parsePreference('light')).toBe('light')
    expect(parsePreference('dark')).toBe('dark')
  })

  it.each([null, undefined, '', 'blue', 'system'])('treats %s as following the device', (value) => {
    expect(parsePreference(value)).toBe('system')
  })
})

describe('the three choices', () => {
  it('are listed in the order the You screen shows them, each with a label', () => {
    expect(PREFERENCES).toEqual(['system', 'light', 'dark'])
    expect(PREFERENCES.map((p) => PREFERENCE_LABELS[p])).toEqual(['System', 'Light', 'Dark'])
  })

  it('cycle from system to light to dark and back to system', () => {
    expect(nextPreference('system')).toBe('light')
    expect(nextPreference('light')).toBe('dark')
    expect(nextPreference('dark')).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('follows the device when set to system', () => {
    expect(resolveTheme('system', true)).toBe('light')
    expect(resolveTheme('system', false)).toBe('dark')
  })

  it('keeps an explicit choice whatever the device says', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })
})

describe('reading and saving the preference', () => {
  it('reads a saved choice', () => {
    expect(readPreference(memoryStorage({ [THEME_STORAGE_KEY]: 'light' }))).toBe('light')
  })

  it('falls back to system when storage is blocked or missing', () => {
    expect(readPreference(throwingStorage)).toBe('system')
    expect(readPreference(undefined)).toBe('system')
  })

  it('stores light or dark, and clears the key for system', () => {
    const storage = memoryStorage()
    savePreference('dark', storage)
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('dark')
    savePreference('system', storage)
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false)
  })

  it('does not throw when storage is blocked', () => {
    expect(() => savePreference('light', throwingStorage)).not.toThrow()
  })
})

describe('applyTheme', () => {
  it('sets the theme on the page and matches the status bar to the base token', () => {
    document.head.innerHTML = '<meta name="theme-color" content="old">'
    document.documentElement.style.setProperty('--koshur-base', '#f7f4ee')
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f7f4ee')
  })

  it('works without a theme-color tag', () => {
    expect(() => applyTheme('dark')).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('following the device', () => {
  it('reports the device setting', () => {
    expect(systemPrefersLight(fakeWindow(true).win)).toBe(true)
  })

  it('notifies on change and stops after unsubscribing', () => {
    const { win, fire, listenerCount } = fakeWindow(false)
    const onChange = vi.fn<(prefersLight: boolean) => void>()
    const stop = watchSystemTheme(onChange, win)
    fire(true)
    expect(onChange).toHaveBeenCalledWith(true)
    stop()
    expect(listenerCount()).toBe(0)
  })

  it('treats a browser without matchMedia as dark and never notifies', () => {
    expect(systemPrefersLight({})).toBe(false)
    const onChange = vi.fn<(prefersLight: boolean) => void>()
    const stop = watchSystemTheme(onChange, {})
    expect(onChange).not.toHaveBeenCalled()
    expect(() => stop()).not.toThrow()
  })
})
