import type { Session } from '@supabase/supabase-js'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { useAuth } from './auth/context.ts'

type Listener = (event: string, session: Session | null) => void

function fakeSession(email?: string): Session {
  return { user: { id: 'user-a', email } } as unknown as Session
}

function fakeClient(initial: Session | null, options: { oauthError?: Error } = {}) {
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
    client: { auth } as unknown as Parameters<typeof AuthProvider>[0]['client'],
    auth,
    unsubscribe,
    load: () => act(async () => resolveSession(initial)),
    emit: (session: Session | null) => act(() => listener('SIGNED_IN', session)),
  }
}

function renderApp(fake: ReturnType<typeof fakeClient>) {
  return render(
    <AuthProvider client={fake.client}>
      <App />
    </AuthProvider>,
  )
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('shows a loading state until the session is known', async () => {
    const fake = fakeClient(null)
    renderApp(fake)
    expect(screen.getByText('Loading')).toBeInTheDocument()
    await fake.load()
    expect(screen.queryByText('Loading')).not.toBeInTheDocument()
  })

  it('asks a signed-out visitor to sign in with Google', async () => {
    const fake = fakeClient(null)
    renderApp(fake)
    await fake.load()
    expect(screen.getByRole('heading', { level: 1, name: 'Shumār' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
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
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't start Google sign-in")
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
  })

  it('explains when Google sends the visitor back with an error', async () => {
    window.history.replaceState(null, '', '/?error=access_denied')
    const fake = fakeClient(null)
    renderApp(fake)
    await fake.load()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't sign you in with Google")
    // Alerts carry an icon as well as text, hidden from screen readers so the text is read once.
    expect(alert.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })

  it('shows who is signed in and signs them out', async () => {
    const fake = fakeClient(fakeSession('a@example.com'))
    renderApp(fake)
    await fake.load()
    expect(screen.getByText('a@example.com')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(fake.auth.signOut).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
  })

  it('stays usable when sign-out fails', async () => {
    const fake = fakeClient(fakeSession('a@example.com'))
    fake.auth.signOut.mockRejectedValueOnce(new Error('offline'))
    renderApp(fake)
    await fake.load()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(fake.auth.signOut).toHaveBeenCalled()
  })

  it('falls back to a generic label when the account has no email', async () => {
    const fake = fakeClient(fakeSession())
    renderApp(fake)
    await fake.load()
    expect(screen.getByText('your Google account')).toBeInTheDocument()
  })

  it('follows sign-in changes from Supabase and stops listening on unmount', async () => {
    const fake = fakeClient(null)
    const { unmount } = renderApp(fake)
    await fake.load()
    fake.emit(fakeSession('b@example.com'))
    expect(screen.getByText('b@example.com')).toBeInTheDocument()

    unmount()
    expect(fake.unsubscribe).toHaveBeenCalled()
  })

  it('ignores a session that arrives after unmount', async () => {
    const fake = fakeClient(fakeSession('a@example.com'))
    const { unmount } = renderApp(fake)
    unmount()
    await expect(fake.load()).resolves.toBeUndefined()
  })
})

describe('useAuth', () => {
  it('refuses to work outside the provider', () => {
    function Probe() {
      useAuth()
      return null
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Probe />)).toThrow('useAuth must be used inside AuthProvider')
    vi.restoreAllMocks()
  })
})
