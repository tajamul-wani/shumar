import { useState } from 'react'
import { useAuth } from '../auth/context.ts'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { signInWithGoogle } from '../lib/auth.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'

function readOAuthError(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('error') ? "We couldn't sign you in with Google. Please try again." : null
}

export function SignIn() {
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <span lang="ks" className="font-wordmark text-heading text-deficit-ring">
          شُمار
        </span>
        <h1 className="m-0 text-heading font-semibold">Shumār</h1>
        <p className="m-0 text-body text-koshur-muted">Your daily tally, built for Kashmiri food.</p>
      </div>
      <Button onClick={handleSignIn} disabled={busy}>
        {busy ? 'Opening Google' : 'Sign in with Google'}
      </Button>
      {error && <Alert>{error}</Alert>}
    </main>
  )
}
