import { useAuth } from './auth/context.ts'
import { Button } from './components/Button.tsx'
import { signOut } from './lib/auth.ts'
import { SignIn } from './screens/SignIn.tsx'

function Wordmark() {
  return (
    <span lang="ks" className="font-wordmark text-heading text-deficit-ring">
      شُمار
    </span>
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
      <Button
        variant="secondary"
        onClick={() => {
          // The device is cleared even if this fails, so there is nothing more to do.
          signOut(client).catch(() => undefined)
        }}
      >
        Sign out
      </Button>
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
