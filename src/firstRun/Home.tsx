import { Lock } from 'lucide-react'
import { useContext } from 'react'
import { Link } from 'wouter'
import { Footer } from '../components/Footer.tsx'
import { Logo } from '../components/Logo.tsx'
import { StarLink } from '../components/StarLink.tsx'
import { ThemeButton } from '../components/ThemeButton.tsx'
import { buttonClass } from '../components/buttonStyles.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'
import { ThemeContext } from '../theme/context.ts'
import { HomeNumbers } from './HomeNumbers.tsx'
import { stepPath } from './paths.ts'
import { SignInButton } from './SignInButton.tsx'
import startDark from '../../docs/images/start-dark.png'
import startLight from '../../docs/images/start-light.png'

const START_ALT = 'Shumār on a phone: two of the six questions, and the daily target they work out'

/** The home page: what a signed-out visitor sees at /, from the first screen to the footer. */
export function Home() {
  useDocumentTitle()
  const theme = useContext(ThemeContext)?.theme ?? 'dark'

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-koshur-base">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:py-4">
          <Logo className="h-8 w-auto sm:h-9" />
          <div className="flex items-center gap-1 sm:gap-2">
            <StarLink />
            <ThemeButton compact />
          </div>
        </div>
      </header>

      <main id="main" className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-12 px-4 pt-12 pb-10 lg:pt-16">
          <div className="flex min-w-0 flex-1 basis-105 flex-col gap-6">
            <h1 tabIndex={-1} className="m-0 text-hero font-semibold tracking-tight focus:outline-none">
              Your daily tally, built for Kashmiri food.
            </h1>
            <p className="m-0 text-body text-koshur-muted md:text-title">
              Six questions give you a daily target. Then log Girda by the piece, Nun Chai by the cup, Haakh
              by the katori, and everyday food by the gram.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={stepPath('age')}
                className={buttonClass('primary', 'large', 'w-full sm:w-auto sm:px-7')}
              >
                Get started
              </Link>
              <SignInButton className="w-full sm:w-auto sm:px-7" />
            </div>
            <p className="m-0 flex items-start gap-1.5 text-caption text-koshur-muted">
              <Lock aria-hidden="true" size={12} strokeWidth={2} className="mt-0.5 size-3 shrink-0" />
              Your answers stay on this device until you sign in.
            </p>
          </div>
          <img
            src={theme === 'light' ? startLight : startDark}
            alt={START_ALT}
            width={1928}
            height={1384}
            loading="lazy"
            className="h-auto w-full min-w-0 flex-1 basis-105"
          />
        </section>

        <HomeNumbers />

        <section
          aria-labelledby="privacy-heading"
          className="mx-auto flex w-full max-w-6xl flex-wrap items-start gap-6 px-4 pb-20"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-koshur-border bg-koshur-surface p-5 lg:p-7">
            <div className="flex items-start gap-3">
              <Lock
                aria-hidden="true"
                size={28}
                strokeWidth={2}
                className="h-9 w-7.5 shrink-0 text-deficit-ring md:size-7"
              />
              <h2 id="privacy-heading" className="m-0 text-title font-semibold md:text-heading">
                Your food logs are private. Only you can see them.
              </h2>
            </div>
            <div className="flex min-w-0 flex-col gap-2 lg:pl-9">
              <p className="m-0 text-body text-koshur-muted">
                You sign in with Google, so Shumār never sees a password. Your logs are stored in India and
                are never sold or shared. Download everything, or delete your account and all of it, from the
                You screen.
              </p>
              <Link
                href="/privacy"
                className="self-start text-body-sm font-semibold text-deficit-ring hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring"
              >
                Read the privacy policy
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
