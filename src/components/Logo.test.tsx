import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeContext } from '../theme/context.ts'
import { Logo } from './Logo.tsx'

function inTheme(theme: 'dark' | 'light', ui: React.ReactNode) {
  return render(
    <ThemeContext.Provider value={{ theme, preference: theme, setPreference: () => {} }}>
      {ui}
    </ThemeContext.Provider>,
  )
}

describe('Logo', () => {
  it.each(['dark', 'light'] as const)(
    'shows the logo drawn for the %s theme, named for screen readers',
    (theme) => {
      inTheme(theme, <Logo />)
      expect(screen.getByRole('img', { name: 'Shumār' })).toHaveAttribute(
        'src',
        `/brand/logo-on-${theme}.svg`,
      )
    },
  )

  it('stays silent for screen readers when it is decorative', () => {
    const { container } = inTheme('dark', <Logo decorative />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })
})
