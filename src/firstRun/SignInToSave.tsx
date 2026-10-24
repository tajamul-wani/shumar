import { useState } from 'react'
import { useAuth } from '../auth/context.ts'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { signInWithGoogle } from '../lib/auth.ts'

/** Before sign-in, the target is kept by signing in: the answers then move to the profile. */
export function SignInToSave() {
  const { client } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      <Button onClick={handleSignIn} disabled={busy} className="w-full">
        {busy ? 'Opening Google' : 'Sign in with Google to save'}
      </Button>
      {error && <Alert>{error}</Alert>}
    </>
  )
}
