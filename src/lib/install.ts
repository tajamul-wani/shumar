import { deviceStorage } from './deviceStorage.ts'

/**
 * Offering to install the app. Browsers that can install it (Chrome and Edge, on Android and on
 * computers) fire `beforeinstallprompt` once the page qualifies; the app keeps that event so a
 * button can open the browser's own install dialog later, in one tap. iPhones and iPads have no
 * such dialog, so there the app shows the two Safari steps instead. Once the app is installed, or
 * opened from the home screen, there is nothing to offer.
 */
export type InstallMode = 'prompt' | 'ios' | 'none'

/** The browser's install offer: not in TypeScript's own types, as only some browsers have it. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Listener = () => void

let offer: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<Listener>()

function changed() {
  for (const listener of listeners) listener()
}

/**
 * Starts listening for the browser's install offer. Called once as the app starts, because the
 * browser can make the offer before any screen is drawn.
 */
export function watchInstall(target: Pick<Window, 'addEventListener'> = window): void {
  target.addEventListener('beforeinstallprompt', (event) => {
    // The app offers it in its own words, so the browser's own small bar stays out of the way.
    event.preventDefault()
    offer = event as InstallPromptEvent
    changed()
  })
  target.addEventListener('appinstalled', () => {
    installed = true
    offer = null
    changed()
  })
}

/** Calls the listener whenever what can be offered changes. Returns a way to stop. */
export function onInstallChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

interface Device {
  navigator: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> & { standalone?: boolean }
  matchMedia: (query: string) => Pick<MediaQueryList, 'matches'>
}

/** True when the app is already running from the home screen, in a window of its own. */
export function isStandalone(device: Device): boolean {
  return device.matchMedia('(display-mode: standalone)').matches || device.navigator.standalone === true
}

/** An iPhone, iPod or iPad. An iPad asks for the desktop site and calls itself a Mac, but has a touch screen. */
export function isAppleMobile(nav: Device['navigator']): boolean {
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
}

/** What the app can offer on this device right now. */
export function installMode(device: Device = window): InstallMode {
  if (installed || isStandalone(device)) return 'none'
  if (offer) return 'prompt'
  return isAppleMobile(device.navigator) ? 'ios' : 'none'
}

/**
 * Opens the browser's own install dialog. The offer can be used once; if the person says no, the
 * button goes until the browser offers again.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = offer
  if (!event) return 'unavailable'
  offer = null
  await event.prompt()
  const { outcome } = await event.userChoice
  if (outcome === 'accepted') installed = true
  changed()
  return outcome
}

/**
 * "Not now" on Today, kept on this device. Like the theme, it is a preference of the device and
 * not personal data, so signing out keeps it.
 */
export const INSTALL_DISMISSED_KEY = 'shumar-install-dismissed'

export function isInstallDismissed(storage: Pick<Storage, 'getItem'> | undefined = deviceStorage()): boolean {
  try {
    return storage?.getItem(INSTALL_DISMISSED_KEY) === 'yes'
  } catch {
    return false
  }
}

export function dismissInstall(storage: Pick<Storage, 'setItem'> | undefined = deviceStorage()): void {
  try {
    storage?.setItem(INSTALL_DISMISSED_KEY, 'yes')
  } catch {
    // Storage blocked: "Not now" lasts until the page closes, which is all that can be done.
  }
}

/** For tests: forgets any offer and installation. */
export function resetInstall(): void {
  offer = null
  installed = false
  listeners.clear()
}
