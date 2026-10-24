import { useState } from 'react'
import { useAuth } from '../auth/context.ts'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import type { ButtonSize } from '../components/buttonStyles.ts'
import { signInWithGoogle } from '../lib/auth.ts'

function readOAuthError(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('error') ? "We couldn't sign you in with Google. Please try again." : null
}

/** "Sign in": starts Google sign-in, and says so when it can't. */
export function SignInButton({ size = 'large', className = '' }: { size?: ButtonSize; className?: string }) {
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
    <>
      <Button
        variant="secondary"
        size={size}
        onClick={handleSignIn}
        disabled={busy}
        className={`whitespace-nowrap ${className}`}
      >
        {busy ? 'Opening Google' : 'Sign in'}
      </Button>
      {error && <Alert>{error}</Alert>}
    </>
  )
}
