import { Redirect, Route, Switch } from 'wouter'
import { useAuth } from './auth/context.ts'
import { LogFoodScreen } from './screens/LogFoodScreen.tsx'
import { SignIn } from './screens/SignIn.tsx'
import { TodayScreen } from './screens/TodayScreen.tsx'
import { TrendsScreen } from './screens/TrendsScreen.tsx'
import { YouScreen } from './screens/YouScreen.tsx'
import { AppShell } from './shell/AppShell.tsx'
import { LOG_FOOD_PATH } from './shell/nav.ts'

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

  return (
    <AppShell>
      <Switch>
        <Route path="/">
          <TodayScreen />
        </Route>
        <Route path="/trends">
          <TrendsScreen />
        </Route>
        <Route path="/you">
          <YouScreen user={session.user} />
        </Route>
        <Route path={LOG_FOOD_PATH}>
          <LogFoodScreen />
        </Route>
        <Route>
          <Redirect to="/" replace />
        </Route>
      </Switch>
    </AppShell>
  )
}
