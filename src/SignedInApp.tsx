import type { Session } from '@supabase/supabase-js'
import { Redirect, Route, Switch } from 'wouter'
import { FIRST_RUN_STEP_PATH, TARGET_PATH } from './firstRun/paths.ts'
import { SetTargetQuestion, SetTargetReview } from './firstRun/SetTarget.tsx'
import { ProfileProvider } from './profile/ProfileProvider.tsx'
import { EditLogScreen } from './screens/EditLogScreen.tsx'
import { LogFoodScreen } from './screens/LogFoodScreen.tsx'
import { PrivacyScreen } from './screens/PrivacyScreen.tsx'
import { SourcesScreen } from './screens/SourcesScreen.tsx'
import { TodayScreen } from './screens/TodayScreen.tsx'
import { TrendsDayScreen } from './screens/TrendsDayScreen.tsx'
import { TrendsScreen } from './screens/TrendsScreen.tsx'
import { YouScreen } from './screens/YouScreen.tsx'
import { AppShell } from './shell/AppShell.tsx'
import { EDIT_LOG_PATH, LOG_FOOD_PATH, TRENDS_DAY_PATH } from './shell/nav.ts'

/** Every signed-in screen in the app's frame. A separate file, so signed-out visitors never download it. */
export default function SignedInApp({ session }: { session: Session }) {
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
          <Route path={TRENDS_DAY_PATH}>
            {(params) => <TrendsDayScreen key={params.date} date={params.date} />}
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
          <Route path="/privacy">
            <PrivacyScreen />
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
