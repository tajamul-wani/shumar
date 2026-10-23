import { Lock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'wouter'
import { useAuth } from '../auth/context.ts'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { buttonClass } from '../components/buttonStyles.ts'
import { signInWithGoogle } from '../lib/auth.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'
import { stepPath } from './paths.ts'

function readOAuthError(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('error') ? "We couldn't sign you in with Google. Please try again." : null
}

/** The first screen a signed-out visitor sees: start the questions, or sign in to an existing account. */
export function Welcome() {
  useDocumentTitle()
  const { client } = useAuth()
  const [error, setError] = useState<string | null>(readOAuthError)
  const [busy, setBusy] = useState(false)

  async function handleSignIn() {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle(client)
    } catch {
      setError("We couldn't start Google sign-in. Check your connection and try again.")
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-between gap-6 pt-9 lg:flex-none lg:justify-start lg:gap-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span lang="ks" className="font-wordmark text-heading text-deficit-ring">
            شُمار
          </span>
          <h1 tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none">
            Shumār
          </h1>
          <p className="m-0 text-body text-koshur-muted">Your daily tally, built for Kashmiri food.</p>
        </div>

        <section
          aria-labelledby="start-title"
          className="flex flex-col gap-3 rounded-2xl border border-koshur-border bg-koshur-surface p-5"
        >
          <h2 id="start-title" className="m-0 text-title font-semibold">
            Find your daily target
          </h2>
          <p className="m-0 text-body">Answer a few questions to work out your daily calories and macros.</p>
          <p className="m-0 flex items-start gap-1.5 text-caption text-koshur-muted">
            <Lock aria-hidden="true" size={12} strokeWidth={2} className="mt-0.5 size-3 shrink-0" />
            Your answers stay on this device until you sign in.
          </p>
        </section>
      </div>

      <div className="flex flex-col gap-3">
        <Link href={stepPath('age')} className={buttonClass('primary', 'large', 'w-full')}>
          Get started
        </Link>
        <Button variant="secondary" onClick={handleSignIn} disabled={busy} className="w-full">
          {busy ? 'Opening Google' : 'I already have an account'}
        </Button>
        {error && <Alert>{error}</Alert>}
      </div>
    </div>
  )
}
