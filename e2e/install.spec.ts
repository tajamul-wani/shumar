import { expect, test, type Page } from '@playwright/test'
import {
  accessibilityViolations,
  createTestUser,
  cspViolations,
  loneWords,
  scrollsSideways,
  signInAs,
  watchCsp,
} from './support.ts'

// The install option (SHU-35). iPhones and iPads get Safari's two steps; Chrome and Edge get the
// browser's own install dialog. A test browser can't show that dialog, so the test makes the
// browser's offer itself and records when the app opens it.

/** The browser's install offer, as Chrome on Android makes it once the page qualifies. */
async function browserOffersInstall(page: Page) {
  await page.evaluate(() => {
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {
        const w = window as unknown as { installPrompts?: number }
        w.installPrompts = (w.installPrompts ?? 0) + 1
      },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })
    window.dispatchEvent(offer)
  })
}

const installPrompts = (page: Page) =>
  page.evaluate(() => (window as unknown as { installPrompts?: number }).installPrompts ?? 0)

for (const theme of ['dark', 'light'] as const) {
  test(`offers to install the app on Today and the You screen, ${theme} theme`, async ({ page }, info) => {
    const apple = /iphone|tablet/.test(info.project.name)
    const wide = info.project.name === 'desktop'
    const user = await createTestUser('install')
    await page.addInitScript((value) => localStorage.setItem('shumar-theme', value), theme)
    await watchCsp(page)
    await signInAs(page, user.session)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeAttached()
    const today = page.getByRole('region', { name: 'Add Shumār to your home screen' })

    if (apple) {
      // No install dialog on an iPhone or iPad: the card shows Safari's two taps instead.
      await expect(today).toBeVisible()
      await today.getByRole('button', { name: 'Show me how' }).click()
      await expect(today.getByRole('list')).toContainText('Add to Home Screen')
    } else {
      await expect(today).toBeHidden()
      await browserOffersInstall(page)
      if (wide) {
        // Wide screens keep it on the You screen only.
        await expect(today).toBeHidden()
      } else {
        await expect(today).toBeVisible()
      }
    }

    if (!wide) {
      const blocking = await accessibilityViolations(page)
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
      // No word alone on a line, from the smallest phone up.
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 800 })
        expect(await loneWords(page), `${width} px`).toEqual([])
      }
      await page.setViewportSize({ width: 320, height: 640 })
      expect(await scrollsSideways(page)).toBe(false)
      if (apple) {
        // Not now hides it on this device for good, even after a reload.
        await today.getByRole('button', { name: 'Not now' }).click()
        await expect(today).toBeHidden()
        await page.reload()
        await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeAttached()
        await expect(today).toBeHidden()
      } else {
        await today.getByRole('button', { name: 'Install' }).click()
        expect(await installPrompts(page)).toBe(1)
        await expect(today).toBeHidden()
      }
    }

    // The You screen keeps the option until the app is installed.
    await page.goto('/you')
    const you = page.getByRole('region', { name: 'Install the app' })
    if (apple) {
      await expect(you.getByRole('list')).toContainText('Tap Share')
    } else {
      await browserOffersInstall(page)
      await you.getByRole('button', { name: 'Install Shumār' }).click()
      expect(await installPrompts(page)).toBe(1)
      await expect(you).toBeHidden()
    }
    expect(await cspViolations(page)).toEqual([])
  })
}

test.describe('in Brave on Android, which only adds a link to the home screen', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  })

  test('points to Chrome, with a link that opens Chrome and one to copy', async ({
    page,
    browserName,
  }, info) => {
    const wide = info.project.name === 'desktop'
    const user = await createTestUser('install-brave')
    // Brave marks itself this way; its address-bar name is the same as Chrome's.
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'brave', { value: { isBrave: async () => true } }),
    )
    if (browserName === 'chromium')
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await watchCsp(page)
    await signInAs(page, user.session)
    await page.goto(wide ? '/you' : '/')
    const card = page.getByRole('region', { name: 'Install Shumār from Chrome' })
    await expect(card).toBeVisible()
    await expect(card).toContainText("This browser can't add Shumār as an app.")
    expect(await card.getByRole('link', { name: 'Open in Chrome' }).getAttribute('href')).toMatch(
      /^intent:\/\/127\.0\.0\.1:4173\/#Intent;scheme=https;package=com\.android\.chrome;/,
    )
    await card.getByRole('button', { name: 'Copy link' }).click()
    // Chromium lets the test copy; where copying is refused, the address shows to copy by hand.
    await expect(page.getByText('Link copied').or(card.getByText('http://127.0.0.1:4173/'))).toBeVisible()
    const blocking = await accessibilityViolations(page)
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
    expect(await cspViolations(page)).toEqual([])
  })
})

for (const width of [320, 360]) {
  test(`says where the app went once installed, on one line above the add button, at ${width} px`, async ({
    page,
  }, info) => {
    const user = await createTestUser('installed')
    await signInAs(page, user.session)
    await page.setViewportSize({ width, height: 640 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeAttached()
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
    for (const words of ['Added to your home screen']) {
      const text = page.getByText(words)
      await expect(text).toBeVisible()
      // One line: the text is no taller than a single line of the toast's type.
      const [height, lineHeight] = await text.evaluate((el) => [
        el.getBoundingClientRect().height,
        parseFloat(getComputedStyle(el).lineHeight),
      ])
      expect(height, `${info.project.name}: ${words}`).toBeLessThanOrEqual(lineHeight * 1.2)
      // Clear of the round add button, which stays free to press.
      const toast = await page.getByRole('status').filter({ hasText: words }).boundingBox()
      const add = await page.getByRole('button', { name: 'Add food' }).nth(1).boundingBox()
      expect(toast!.y + toast!.height, `${info.project.name}: ${words}`).toBeLessThanOrEqual(add!.y)
    }
  })
}
