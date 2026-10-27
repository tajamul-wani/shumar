import { lazy, Suspense } from 'react'
import { useAuth } from './auth/context.ts'
import { LoadingMark } from './components/LoadingMark.tsx'
import { UpdateNotice } from './components/UpdateNotice.tsx'

// The signed-out pages and the signed-in app are separate files, so each visitor downloads only
// the half they use. Both are kept for offline use once the app is installed.
const FirstRun = lazy(() =>
  import('./firstRun/FirstRun.tsx').then((module) => ({ default: module.FirstRun })),
)
const SignedInApp = lazy(() => import('./SignedInApp.tsx'))

/** What shows while the session is read, and while the right half of the app arrives: the mark, running. */
function Loading() {
  return (
    <main aria-busy="true" className="flex min-h-dvh items-center justify-center px-4">
      <LoadingMark />
      <p className="sr-only">Loading</p>
    </main>
  )
}

export default function App() {
  const { session, loading } = useAuth()
  if (loading) return <Loading />
  return (
    <>
      <Suspense fallback={<Loading />}>{session ? <SignedInApp session={session} /> : <FirstRun />}</Suspense>
      {/* Signed in, phones have the round add button in the toast's corner. */}
      <UpdateNotice besideAddButton={session !== null} />
    </>
  )
}
