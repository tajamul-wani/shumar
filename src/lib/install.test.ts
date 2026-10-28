import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  INSTALL_DISMISSED_KEY,
  cannotInstallOnAndroid,
  chromeLink,
  dismissInstall,
  installMode,
  isAppleMobile,
  isInstallDismissed,
  isSafari,
  isStandalone,
  onInstallChange,
  promptInstall,
  resetInstall,
  watchInstall,
} from './install.ts'

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

function device({
  userAgent = ANDROID,
  platform = 'Linux armv8l',
  maxTouchPoints = 5,
  standalone = false,
  displayStandalone = false,
  brave = false,
} = {}) {
  return {
    navigator: { userAgent, platform, maxTouchPoints, standalone, ...(brave ? { brave: {} } : {}) },
    matchMedia: (query: string) => ({ matches: displayStandalone && query === '(display-mode: standalone)' }),
  }
}

/** A window to fire the browser's events on, and a fake install offer. */
function browser() {
  const handlers: Record<string, (event: Event) => void> = {}
  const target = {
    addEventListener: (type: string, handler: (event: Event) => void) => (handlers[type] = handler),
  }
  watchInstall(target as unknown as Window)
  return {
    offer(outcome: 'accepted' | 'dismissed' = 'accepted') {
      const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: vi.fn<() => Promise<void>>(async () => undefined),
        userChoice: Promise.resolve({ outcome }),
      })
      handlers.beforeinstallprompt(event)
      return event
    },
    installed: () => handlers.appinstalled(new Event('appinstalled')),
  }
}

afterEach(() => resetInstall())

describe('where the app can be installed', () => {
  it('tells iPhones and iPads apart, including an iPad that calls itself a Mac', () => {
    expect(isAppleMobile(device({ userAgent: IPHONE }).navigator)).toBe(true)
    expect(isAppleMobile(device({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 }).navigator)).toBe(
      true,
    )
    expect(isAppleMobile(device({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 }).navigator)).toBe(
      false,
    )
    expect(isAppleMobile(device().navigator)).toBe(false)
  })

  it('knows when it already runs from the home screen', () => {
    expect(isStandalone(device({ displayStandalone: true }))).toBe(true)
    expect(isStandalone(device({ userAgent: IPHONE, standalone: true }))).toBe(true)
    expect(isStandalone(device())).toBe(false)
  })
})

describe('installMode', () => {
  it('offers nothing on Android until the browser makes its offer, then the install dialog', () => {
    const fake = browser()
    expect(installMode(device())).toBe('none')
    const event = fake.offer()
    expect(event.defaultPrevented).toBe(true)
    expect(installMode(device())).toBe('prompt')
  })

  it("offers Safari's steps on an iPhone, and nothing once it runs from the home screen", () => {
    browser()
    expect(installMode(device({ userAgent: IPHONE }))).toBe('ios')
    expect(installMode(device({ userAgent: IPHONE, standalone: true }))).toBe('none')
  })

  it('offers nothing once the app is installed, and tells listeners each time', () => {
    const fake = browser()
    const listener = vi.fn<() => void>()
    const stop = onInstallChange(listener)
    fake.offer()
    fake.installed()
    expect(installMode(device())).toBe('none')
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
    fake.offer()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('promptInstall', () => {
  it("opens the browser's dialog once, and offers nothing after a yes", async () => {
    const fake = browser()
    const event = fake.offer('accepted')
    expect(await promptInstall()).toBe('accepted')
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(installMode(device())).toBe('none')
    expect(await promptInstall()).toBe('unavailable')
  })

  it('waits for the next offer after a no', async () => {
    const fake = browser()
    fake.offer('dismissed')
    expect(await promptInstall()).toBe('dismissed')
    expect(installMode(device())).toBe('none')
    fake.offer()
    expect(installMode(device())).toBe('prompt')
  })
})

describe('Not now', () => {
  it('is remembered on the device', () => {
    const items = new Map<string, string>()
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    }
    expect(isInstallDismissed(storage)).toBe(false)
    dismissInstall(storage)
    expect(items.get(INSTALL_DISMISSED_KEY)).toBe('yes')
    expect(isInstallDismissed(storage)).toBe(true)
  })

  it('never breaks when the browser blocks storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(isInstallDismissed(blocked)).toBe(false)
    expect(() => dismissInstall(blocked)).not.toThrow()
    expect(isInstallDismissed(undefined)).toBe(false)
  })
})

const CHROME_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1'
const IPHONE_APP =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0'
const FIREFOX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0'
const ANDROID_APP =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36'

describe('browsers that point elsewhere', () => {
  it("tells Safari from other iPhone browsers and apps' own browsers", () => {
    expect(isSafari(device({ userAgent: IPHONE }).navigator)).toBe(true)
    expect(isSafari(device({ userAgent: CHROME_IPHONE }).navigator)).toBe(false)
    expect(isSafari(device({ userAgent: IPHONE_APP }).navigator)).toBe(false)
  })

  it("finds the Android browsers that can't install: Brave, Firefox, and apps' own browsers", () => {
    expect(cannotInstallOnAndroid(device({ brave: true }).navigator)).toBe(true)
    expect(cannotInstallOnAndroid(device({ userAgent: FIREFOX_ANDROID }).navigator)).toBe(true)
    expect(cannotInstallOnAndroid(device({ userAgent: ANDROID_APP }).navigator)).toBe(true)
    expect(cannotInstallOnAndroid(device().navigator)).toBe(false)
    // Brave on a computer installs apps properly.
    expect(
      cannotInstallOnAndroid(
        device({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0, brave: true }).navigator,
      ),
    ).toBe(false)
  })

  it('points each to the browser that can install it, unless it already runs from the home screen', () => {
    browser()
    expect(installMode(device({ userAgent: CHROME_IPHONE }))).toBe('ios-other')
    expect(installMode(device({ userAgent: IPHONE_APP }))).toBe('ios-other')
    expect(installMode(device({ brave: true }))).toBe('elsewhere')
    expect(installMode(device({ userAgent: ANDROID_APP }))).toBe('elsewhere')
    expect(installMode(device({ brave: true, displayStandalone: true }))).toBe('none')
  })

  it("prefers Chrome over a Brave install offer, since Brave's install only adds a link", () => {
    const fake = browser()
    fake.offer()
    expect(installMode(device({ brave: true }))).toBe('elsewhere')
  })

  it('builds a link that opens the page in Chrome, falling back to the page itself', () => {
    expect(chromeLink('https://shumar.example/you?x=1')).toBe(
      'intent://shumar.example/you?x=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fshumar.example%2Fyou%3Fx%3D1;end',
    )
  })
})
