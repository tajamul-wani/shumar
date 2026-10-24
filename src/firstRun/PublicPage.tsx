import type { ReactNode } from 'react'
import { Link } from 'wouter'
import { Footer } from '../components/Footer.tsx'
import { Logo } from '../components/Logo.tsx'
import { StarLink } from '../components/StarLink.tsx'
import { ThemeButton } from '../components/ThemeButton.tsx'
import { SignInButton } from './SignInButton.tsx'

/** A page anyone can read without signing in, such as the sources or the privacy policy: header, content, footer. */
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-koshur-base">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:py-4">
          <Link
            href="/"
            aria-label="Shumār home"
            className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring"
          >
            <Logo decorative className="h-8 w-auto sm:h-9" />
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <StarLink />
            <ThemeButton compact />
            <SignInButton size="small" />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-10 pb-20">
        {children}
      </main>
      <Footer />
    </div>
  )
}
