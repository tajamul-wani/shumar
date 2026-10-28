import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { INSTALL_DISMISSED_KEY, resetInstall, watchInstall } from '../lib/install.ts'
import { InstallCard } from './InstallCard.tsx'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

/** The browser making its install offer, as Chrome on Android does once the page qualifies. */
function browserOffers(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const handlers: Record<string, (event: Event) => void> = {}
  watchInstall({
    addEventListener: (type: string, handler: (event: Event) => void) => (handlers[type] = handler),
  } as unknown as Window)
  const prompt = vi.fn<() => Promise<void>>(async () => undefined)
  act(() =>
    handlers.beforeinstallprompt(
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt,
        userChoice: Promise.resolve({ outcome }),
      }),
    ),
  )
  return prompt
}

function onIphone({ fromHomeScreen = false } = {}) {
  vi.stubGlobal('navigator', {
    ...navigator,
    userAgent: IPHONE,
    platform: 'iPhone',
    maxTouchPoints: 5,
    standalone: fromHomeScreen,
  })
}

afterEach(() => {
  resetInstall()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('where the browser can install the app', () => {
  it("shows nothing until the browser makes its offer, then opens the browser's own dialog", async () => {
    render(<InstallCard place="today" />)
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    const prompt = browserOffers('accepted')
    const card = screen.getByRole('region', { name: 'Add Shumār to your home screen' })
    expect(card).toHaveTextContent('It opens like an app, and works without a connection.')
    await userEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('remembers Not now on this device, and the You screen still offers it', async () => {
    browserOffers()
    const { unmount } = render(<InstallCard place="today" />)
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe('yes')
    unmount()
    render(
      <>
        <InstallCard place="today" />
        <InstallCard place="you" />
      </>,
    )
    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Install the app' })).toHaveTextContent(
      'It opens in its own window',
    )
    expect(screen.getByRole('button', { name: 'Install Shumār' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Not now' })).not.toBeInTheDocument()
  })
})

describe('on an iPhone or iPad', () => {
  it("shows Safari's two taps on Today when asked", async () => {
    onIphone()
    render(<InstallCard place="today" />)
    expect(screen.queryByText('Add to Home Screen')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show me how' }))
    // The icon sits between the words and the comma, so the text has a space there; screen readers skip it.
    expect(screen.getByRole('list')).toHaveTextContent(
      "Tap Share in Safari's toolbar.Choose Add to Home Screen , then Add.",
    )
    expect(screen.queryByRole('button', { name: 'Show me how' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
  })

  it('shows the steps straight away on the You screen', () => {
    onIphone()
    render(<InstallCard place="you" />)
    expect(screen.getByRole('region', { name: 'Install the app' })).toHaveTextContent(
      'Safari adds it in two taps:',
    )
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers nothing once the app runs from the home screen', () => {
    onIphone({ fromHomeScreen: true })
    render(
      <>
        <InstallCard place="today" />
        <InstallCard place="you" />
      </>,
    )
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
})
