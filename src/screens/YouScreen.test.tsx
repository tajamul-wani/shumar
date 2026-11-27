import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AppClient } from '../auth/context.ts'
import type { AccountUser } from '../lib/account.ts'
import { ProfileContext } from '../profile/context.ts'
import { ThemeProvider } from '../theme/ThemeProvider.tsx'
import { YouScreen } from './YouScreen.tsx'

function fakeClient() {
  const from = vi.fn<(table: string) => unknown>(() => ({
    select: vi.fn<() => unknown>(() => ({
      order: vi.fn<() => Promise<unknown>>(() => Promise.resolve({ data: [], error: null })),
    })),
  }))
  return { auth: {}, from } as unknown as AppClient
}

const TEST_USER: AccountUser = {
  email: 'tajamul@example.com',
  user_metadata: { full_name: 'Tajamul Wani' },
  app_metadata: { provider: 'google' },
}

function renderScreen(user = TEST_USER) {
  const client = fakeClient()
  return render(
    <ThemeProvider>
      <AuthContext.Provider value={{ client, session: null, loading: false }}>
        <ProfileContext.Provider
          value={{
            status: 'ready',
            answers: null,
            error: null,
            editing: null,
            edit: () => {},
            reload: () => {},
            save: async () => {},
          }}
        >
          <YouScreen user={user} />
        </ProfileContext.Provider>
      </AuthContext.Provider>
    </ThemeProvider>,
  )
}

describe('YouScreen', () => {
  it('renders the account name and sign-in status', () => {
    renderScreen()
    expect(screen.getByText('Tajamul Wani')).toBeInTheDocument()
    expect(screen.getByText('Signed in with Google')).toBeInTheDocument()
  })

  it('renders the appearance theme selector and toggles preferences', async () => {
    const user = userEvent.setup()
    renderScreen()

    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument()
    const lightButton = screen.getByRole('button', { name: 'Light' })
    const darkButton = screen.getByRole('button', { name: 'Dark' })

    await user.click(lightButton)
    expect(lightButton).toHaveAttribute('aria-pressed', 'true')

    await user.click(darkButton)
    expect(darkButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders the about card with links and the release version 1.0', () => {
    renderScreen()

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /where food values come from/i })).toHaveAttribute(
      'href',
      '/sources',
    )
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy')

    const versionNotice = screen.getByText(/Shum\u0101r 1\.0/i)
    expect(versionNotice).toBeInTheDocument()
    expect(versionNotice).toHaveTextContent(
      'Ingredient values from USDA FoodData Central, in the public domain. Shum\u0101r 1.0',
    )
  })
})
