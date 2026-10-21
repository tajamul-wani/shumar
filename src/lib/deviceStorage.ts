/**
 * The browser's local storage, or nothing when the browser blocks it (strict privacy settings
 * can make even reading it throw). Everything the app keeps on the device goes through here,
 * so a blocked storage means "remember less", never a broken screen.
 */
export function deviceStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}
