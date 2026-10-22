import { ChevronRight } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { useAuth } from '../auth/context.ts'
import { Button } from '../components/Button.tsx'
import { summarizeAccount, type AccountUser } from '../lib/account.ts'
import { signOut } from '../lib/auth.ts'
import { PREFERENCES, PREFERENCE_LABELS, type ThemePreference } from '../lib/theme.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'
import { useTheme } from '../theme/context.ts'

const CARD = 'rounded-2xl border border-koshur-border bg-koshur-surface'

/** "phone" on phones and tablets, "computer" from 1024 px up, as the design words it. */
function Device() {
  return (
    <>
      <span className="lg:hidden">phone</span>
      <span className="hidden lg:inline">computer</span>
    </>
  )
}

function PreferenceHint({ preference }: { preference: ThemePreference }) {
  if (preference === 'light') {
    return (
      <>
        Always light, whatever your <Device /> uses.
      </>
    )
  }
  if (preference === 'dark') return <>Always dark, easier on the eyes at night.</>
  return (
    <>
      Follows your <Device />.
    </>
  )
}

function Appearance() {
  const { preference, setPreference } = useTheme()
  return (
    <section aria-labelledby="appearance-heading" className={`${CARD} flex min-w-0 flex-col gap-3 p-5`}>
      <h2 id="appearance-heading" className="m-0 text-body font-semibold">
        Appearance
      </h2>
      <fieldset className="m-0 grid min-w-0 grid-cols-3 rounded-xl border border-koshur-border bg-koshur-base p-1">
        <legend className="sr-only">Theme</legend>
        {PREFERENCES.map((option) => {
          const pressed = option === preference
          return (
            <button
              key={option}
              type="button"
              aria-pressed={pressed}
              onClick={() => setPreference(option)}
              className={`min-h-11 rounded-lg text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring ${
                pressed ? 'bg-koshur-surface font-semibold text-koshur-silk' : 'font-medium text-koshur-muted'
              }`}
            >
              {PREFERENCE_LABELS[option]}
            </button>
          )
        })}
      </fieldset>
      <p className="m-0 text-body-sm text-koshur-muted">
        <PreferenceHint preference={preference} />
      </p>
    </section>
  )
}

function About() {
  return (
    <section aria-labelledby="about-heading" className={`${CARD} min-w-0 overflow-hidden`}>
      <h2 id="about-heading" className="m-0 px-5 pt-4 pb-2 text-body font-semibold">
        About
      </h2>
      <Link
        href="/sources"
        className="flex min-h-13 items-start justify-between gap-3 border-t border-koshur-border px-5 py-3.5 text-body text-koshur-silk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring focus-visible:ring-inset lg:min-h-12 lg:text-body-sm"
      >
        Where food values come from
        <ChevronRight
          aria-hidden="true"
          size={20}
          strokeWidth={2}
          className="mt-0.5 shrink-0 text-koshur-muted lg:hidden"
        />
      </Link>
      <p className="m-0 border-t border-koshur-border px-5 pt-3 pb-4 text-caption text-koshur-muted">
        Ingredient values from USDA FoodData Central, in the public domain. Shumār 0.1
      </p>
    </section>
  )
}

export function YouScreen({ user }: { user: AccountUser }) {
  useDocumentTitle('You')
  const { client } = useAuth()
  const [, navigate] = useLocation()
  const { name, detail, initial } = summarizeAccount(user)

  async function handleSignOut() {
    // The device is cleared even if this fails, so there is nothing more to do on an error.
    await signOut(client).catch(() => undefined)
    navigate('/', { replace: true })
  }

  return (
    <>
      <h1 tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none">
        You
      </h1>
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <section aria-label="Account" className={`${CARD} flex min-w-0 items-start gap-3.5 px-5 py-4`}>
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border border-koshur-border bg-koshur-base text-title font-semibold text-deficit-ring"
          >
            {initial}
          </span>
          <span className="flex min-w-0 grow flex-col gap-0.5">
            <span className="text-body font-semibold wrap-anywhere">{name}</span>
            {detail && <span className="text-body-sm text-koshur-muted wrap-anywhere">{detail}</span>}
          </span>
          {/* A wrapper hides it on phones: the button's own display class would win over "hidden". */}
          <div className="hidden shrink-0 self-center lg:block">
            <Button variant="secondary" size="small" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </section>
        <div className="flex min-w-0 flex-col gap-4">
          <Appearance />
          <About />
        </div>
      </div>
      <Button variant="secondary" className="w-full lg:hidden" onClick={handleSignOut}>
        Sign out
      </Button>
    </>
  )
}
