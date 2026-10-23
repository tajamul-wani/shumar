import type { Session } from '@supabase/supabase-js'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { useAuth } from './auth/context.ts'
import { THEME_STORAGE_KEY } from './lib/theme.ts'
import { useTheme } from './theme/context.ts'
import { ThemeProvider } from './theme/ThemeProvider.tsx'

type Listener = (event: string, session: Session | null) => void

function fakeSession(fields: { email?: string; name?: string; provider?: string } = {}): Session {
  return {
    user: {
      id: 'user-a',
      email: fields.email,
      user_metadata: fields.name ? { full_name: fields.name } : {},
      app_metadata: fields.provider ? { provider: fields.provider } : {},
    },
  } as unknown as Session
}

const tajamul = () => fakeSession({ email: 'a@example.com', name: 'Tajamul Wani', provider: 'google' })

function fakeClient(initial: Session | null, options: { oauthError?: Error; releasesFail?: boolean } = {}) {
  let listener: Listener = () => undefined
  let resolveSession: (session: Session | null) => void = () => undefined
  const unsubscribe = vi.fn<() => void>()
  const auth = {
    getSession: vi.fn<() => Promise<unknown>>(
      () =>
        new Promise((resolve) => {
          resolveSession = (session) => resolve({ data: { session }, error: null })
        }),
    ),
    onAuthStateChange: vi.fn<(callback: Listener) => unknown>((callback) => {
      listener = callback
      return { data: { subscription: { unsubscribe } } }
    }),
    signInWithOAuth: vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ data: {}, error: options.oauthError ?? null }),
    signOut: vi.fn<() => Promise<unknown>>(async () => {
      listener('SIGNED_OUT', null)
      return { error: null }
    }),
  }
  return {
    client: {
      auth,
      from: () => ({
        select: () => ({
          eq: () => ({
            // A changed food that isn't there, for the edit screen.
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            // Nothing logged yet, for the Today screen.
            order: () => Promise.resolve({ data: [], error: null }),
          }),
          order: () =>
            Promise.resolve(
              options.releasesFail
                ? { data: null, error: { message: 'offline' } }
                : {
                    data: [
                      {
                        dataset: 'foundation_food',
                        file_name: 'FoodData_Central_foundation_food_csv_2026-04-30.zip',
                      },
                      {
                        dataset: 'sr_legacy_food',
                        file_name: 'FoodData_Central_sr_legacy_food_csv_2018-04.zip',
                      },
                    ],
                    error: null,
                  },
            ),
        }),
      }),
      rpc: () => Promise.resolve({ data: 0, error: null }),
    } as unknown as Parameters<typeof AuthProvider>[0]['client'],
    auth,
    unsubscribe,
    load: () => act(async () => resolveSession(initial)),
    emit: (session: Session | null) => act(() => listener('SIGNED_IN', session)),
  }
}

function renderApp(fake: ReturnType<typeof fakeClient>, path = '/') {
  window.history.replaceState(null, '', path)
  return render(
    <ThemeProvider>
      <AuthProvider client={fake.client}>
        <App />
      </AuthProvider>
    </ThemeProvider>,
  )
}

async function signedIn(path = '/') {
  const fake = fakeClient(tajamul())
  renderApp(fake, path)
  await fake.load()
  return fake
}

/** jsdom applies no CSS, so both navigations are present: index 0 is the side navigation, 1 the tab bar. */
function sideNav() {
  return screen.getAllByRole('navigation', { name: 'Main' })[0]
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('signed out', () => {
  it('shows a loading state until the session is known', async () => {
    const fake = fakeClient(null)
    renderApp(fake)
    expect(screen.getByText('Loading')).toBeInTheDocument()
    await fake.load()
    expect(screen.queryByText('Loading')).not.toBeInTheDocument()
  })

  it('lets a signed-out visitor with an account sign in with Google', async () => {
    const fake = fakeClient(null)
    renderApp(fake)
    await fake.load()
    expect(screen.getByRole('heading', { level: 1, name: 'Shumār' })).toBeInTheDocument()
    expect(document.title).toBe('Shumār')

    await userEvent.click(screen.getByRole('button', { name: 'I already have an account' }))
    expect(fake.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    expect(screen.getByRole('button', { name: 'Opening Google' })).toBeDisabled()
  })

  it('explains when Google sign-in cannot start', async () => {
    const fake = fakeClient(null, { oauthError: new Error('offline') })
    renderApp(fake)
    await fake.load()
    await userEvent.click(screen.getByRole('button', { name: 'I already have an account' }))
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't start Google sign-in")
    expect(screen.getByRole('button', { name: 'I already have an account' })).toBeEnabled()
  })

  it('explains when Google sends the visitor back with an error', async () => {
    const fake = fakeClient(null)
    renderApp(fake, '/?error=access_denied')
    await fake.load()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't sign you in with Google")
    // Alerts carry an icon as well as text, hidden from screen readers so the text is read once.
    expect(alert.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })
})

describe('the app shell', () => {
  it('opens on Today with the date and both navigations', async () => {
    await signedIn()
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(document.title).toBe('Today · Shumār')
    for (const nav of screen.getAllByRole('navigation', { name: 'Main' })) {
      expect(
        within(nav)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['Today', 'Trends', 'You'])
      expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
    }
  })

  it('moves between screens, marks the current one and focuses its heading', async () => {
    await signedIn()
    await userEvent.click(within(sideNav()).getByRole('link', { name: 'Trends' }))
    expect(window.location.pathname).toBe('/trends')
    const heading = screen.getByRole('heading', { level: 1, name: 'Trends' })
    expect(heading).toHaveFocus()
    expect(document.title).toBe('Trends · Shumār')
    expect(within(sideNav()).getByRole('link', { name: 'Trends' })).toHaveAttribute('aria-current', 'page')
    expect(within(sideNav()).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current')
  })

  it('opens the screen in the address on load', async () => {
    await signedIn('/you')
    expect(screen.getByRole('heading', { level: 1, name: 'You' })).toBeInTheDocument()
  })

  it('sends an unknown address to Today', async () => {
    await signedIn('/no-such-screen')
    expect(window.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
  })

  it('opens Add food from the add button, which then hides', async () => {
    await signedIn()
    await userEvent.click(screen.getByRole('link', { name: 'Log food' }))
    expect(window.location.pathname).toBe('/log')
    expect(screen.getByRole('heading', { level: 1, name: 'Add food' })).toBeInTheDocument()
    expect(document.title).toBe('Add food · Shumār')
    expect(screen.queryByRole('link', { name: 'Log food' })).not.toBeInTheDocument()
  })

  it('hides the add button while changing a logged food', async () => {
    await signedIn('/log/edit/log-1')
    expect(
      await screen.findByText("We couldn't find this food. It may have been removed."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log food' })).not.toBeInTheDocument()
  })

  it('steps the theme through System, Light and Dark from the side navigation', async () => {
    await signedIn()
    const button = () => within(screen.getByRole('complementary')).getByRole('button')
    expect(button()).toHaveAccessibleName('Theme: System. Switch to Light')

    await userEvent.click(button())
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(button()).toHaveTextContent('Theme: Light')

    await userEvent.click(button())
    expect(document.documentElement.dataset.theme).toBe('dark')

    await userEvent.click(button())
    expect(button()).toHaveAccessibleName('Theme: System. Switch to Light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })
})

describe('the food sources page', () => {
  it('opens from the You screen and lists the USDA releases in use', async () => {
    await signedIn('/you')
    expect(screen.getByRole('region', { name: 'About' })).toHaveTextContent(
      'USDA FoodData Central, in the public domain',
    )
    await userEvent.click(screen.getByRole('link', { name: 'Where food values come from' }))
    expect(window.location.pathname).toBe('/sources')
    expect(screen.getByRole('heading', { level: 1, name: 'Where food values come from' })).toHaveFocus()
    expect(document.title).toBe('Food sources · Shumār')
    expect(await screen.findByText('Foundation Foods, April 2026')).toBeInTheDocument()
    expect(screen.getByText('SR Legacy, April 2018')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Visit USDA FoodData Central (opens in a new tab)' }),
    ).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('says so when the release list cannot load', async () => {
    const fake = fakeClient(tajamul(), { releasesFail: true })
    renderApp(fake, '/sources')
    await fake.load()
    expect(await screen.findByText(/couldn't load the list of USDA releases/)).toBeInTheDocument()
  })
})

describe('the You screen', () => {
  it('shows the account from Google', async () => {
    await signedIn('/you')
    const account = screen.getByRole('region', { name: 'Account' })
    expect(account).toHaveTextContent('Tajamul Wani')
    expect(account).toHaveTextContent('Signed in with Google')
    expect(account).toHaveTextContent('T')
  })

  it('switches the theme and explains each choice', async () => {
    await signedIn('/you')
    const group = screen.getByRole('group', { name: 'Theme' })
    expect(within(group).getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: 'Appearance' })).toHaveTextContent(
      'Follows your phonecomputer.',
    )

    await userEvent.click(within(group).getByRole('button', { name: 'Light' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(within(group).getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: 'Appearance' })).toHaveTextContent('Always light, whatever')

    await userEvent.click(within(group).getByRole('button', { name: 'Dark' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('region', { name: 'Appearance' })).toHaveTextContent(
      'Always dark, easier on the eyes',
    )
  })

  it('signs out and returns to the sign-in screen at the start address', async () => {
    const fake = await signedIn('/you')
    await userEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0])
    expect(fake.auth.signOut).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'I already have an account' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('stays usable when sign-out fails', async () => {
    const fake = fakeClient(tajamul())
    fake.auth.signOut.mockRejectedValueOnce(new Error('offline'))
    renderApp(fake, '/you')
    await fake.load()
    await userEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[1])
    expect(fake.auth.signOut).toHaveBeenCalled()
  })
})

describe('session changes', () => {
  it('follows sign-in changes from Supabase and stops listening on unmount', async () => {
    const fake = fakeClient(null)
    const { unmount } = renderApp(fake)
    await fake.load()
    fake.emit(fakeSession({ email: 'b@example.com' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()

    unmount()
    expect(fake.unsubscribe).toHaveBeenCalled()
  })

  it('ignores a session that arrives after unmount', async () => {
    const fake = fakeClient(tajamul())
    const { unmount } = renderApp(fake)
    unmount()
    await expect(fake.load()).resolves.toBeUndefined()
  })
})

describe('hooks outside their providers', () => {
  it('refuse to work', () => {
    function AuthProbe() {
      useAuth()
      return null
    }
    function ThemeProbe() {
      useTheme()
      return null
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<AuthProbe />)).toThrow('useAuth must be used inside AuthProvider')
    expect(() => render(<ThemeProbe />)).toThrow('useTheme must be used inside ThemeProvider')
    vi.restoreAllMocks()
  })
})
