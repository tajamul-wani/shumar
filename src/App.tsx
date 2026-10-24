import { Redirect, Route, Switch } from 'wouter'
import { useAuth } from './auth/context.ts'
import { FirstRun } from './firstRun/FirstRun.tsx'
import { FIRST_RUN_STEP_PATH, TARGET_PATH } from './firstRun/paths.ts'
import { SetTargetQuestion, SetTargetReview } from './firstRun/SetTarget.tsx'
import { ProfileProvider } from './profile/ProfileProvider.tsx'
import { EditLogScreen } from './screens/EditLogScreen.tsx'
import { LogFoodScreen } from './screens/LogFoodScreen.tsx'
import { SourcesScreen } from './screens/SourcesScreen.tsx'
import { TodayScreen } from './screens/TodayScreen.tsx'
import { TrendsScreen } from './screens/TrendsScreen.tsx'
import { YouScreen } from './screens/YouScreen.tsx'
import { AppShell } from './shell/AppShell.tsx'
import { EDIT_LOG_PATH, LOG_FOOD_PATH } from './shell/nav.ts'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <main aria-busy="true" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
        <p className="m-0 text-body text-koshur-muted">Loading</p>
      </main>
    )
  }
  if (!session) return <FirstRun />

  return (
    <ProfileProvider userId={session.user.id}>
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
          <Route path={EDIT_LOG_PATH}>{(params) => <EditLogScreen key={params.id} id={params.id} />}</Route>
          <Route path="/sources">
            <SourcesScreen />
          </Route>
          <Route path={TARGET_PATH}>
            <SetTargetReview />
          </Route>
          <Route path={FIRST_RUN_STEP_PATH}>{(params) => <SetTargetQuestion step={params.step} />}</Route>
          <Route>
            <Redirect to="/" replace />
          </Route>
        </Switch>
      </AppShell>
    </ProfileProvider>
  )
}
