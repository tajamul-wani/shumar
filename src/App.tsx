import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from './auth/context.ts'
import { signInWithGoogle, signOut } from './lib/auth.ts'

function readOAuthError(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('error') ? "We couldn't sign you in with Google. Please try again." : null
}

function Wordmark() {
  return (
    <span lang="ks" className="font-wordmark text-heading text-deficit-ring">
      شُمار
    </span>
  )
}

function SignIn() {
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <Wordmark />
        <h1 className="m-0 text-heading font-semibold">Shumār</h1>
        <p className="m-0 text-body text-koshur-muted">Your daily tally, built for Kashmiri food.</p>
      </div>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={busy}
        className="min-h-12 rounded-xl bg-deficit-ring px-4 text-body font-semibold text-koshur-surface focus-visible:ring-2 focus-visible:ring-deficit-ring focus-visible:ring-offset-2 focus-visible:ring-offset-koshur-base disabled:opacity-60"
      >
        {busy ? 'Opening Google' : 'Sign in with Google'}
      </button>
      {error && (
        <p role="alert" className="m-0 flex items-start gap-2 text-body-sm text-koshur-silk">
          <CircleAlert aria-hidden="true" size={20} strokeWidth={2} className="shrink-0 text-alert-surplus" />
          {error}
        </p>
      )}
    </main>
  )
}

function SignedIn({ email }: { email: string }) {
  const { client } = useAuth()

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <Wordmark />
        <h1 className="m-0 text-heading font-semibold">Shumār</h1>
        <p className="m-0 text-body text-koshur-muted">
          Signed in as <span className="text-koshur-silk">{email}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          // The device is cleared even if this fails, so there is nothing more to do.
          signOut(client).catch(() => undefined)
        }}
        className="min-h-12 rounded-xl border border-koshur-border bg-koshur-surface px-4 text-body font-semibold text-koshur-silk focus-visible:ring-2 focus-visible:ring-deficit-ring"
      >
        Sign out
      </button>
    </main>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <main aria-busy="true" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
        <p className="m-0 text-body text-koshur-muted">Loading</p>
      </main>
    )
  }
  if (!session) return <SignIn />
  return <SignedIn email={session.user.email ?? 'your Google account'} />
}
