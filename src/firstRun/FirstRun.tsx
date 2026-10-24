import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'
import {
  firstUnanswered,
  readAnswers,
  saveAnswers,
  toProfile,
  type FirstRunAnswers,
} from '../lib/firstRun.ts'
import { PrivacyScreen } from '../screens/PrivacyScreen.tsx'
import { SourcesScreen } from '../screens/SourcesScreen.tsx'
import { Home } from './Home.tsx'
import { FIRST_RUN_STEP_PATH, TARGET_PATH, stepPath } from './paths.ts'
import { PublicPage } from './PublicPage.tsx'
import { QuestionRoute } from './QuestionRoute.tsx'
import { SignInToSave } from './SignInToSave.tsx'
import { StandaloneContext } from './standalone.ts'
import { TargetScreen } from './TargetScreen.tsx'

/** The narrow frame the questions and the target sit in. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-3 pb-8 lg:pt-8">
      {children}
    </main>
  )
}

/**
 * Everything a signed-out visitor sees: the home page, the pages anyone can read, the first-run
 * questions and the daily target they lead to. Answers are kept on this device as they are given,
 * so a reload or a step back keeps them.
 */
export function FirstRun() {
  const [answers, setAnswers] = useState<FirstRunAnswers>(() => readAnswers())
  const [location] = useLocation()

  // After moving to another screen, put keyboard and screen reader focus on its heading.
  const previousLocation = useRef(location)
  useEffect(() => {
    if (previousLocation.current === location) return
    previousLocation.current = location
    document.querySelector<HTMLElement>('#main h1')?.focus()
  }, [location])

  function change(next: FirstRunAnswers) {
    setAnswers(next)
    saveAnswers(next)
  }

  function renderTarget() {
    const profile = toProfile(answers)
    if (!profile) return <Redirect to={stepPath(firstUnanswered(answers) ?? 'age')} replace />
    return (
      <Frame>
        <TargetScreen profile={profile} weightUnit={answers.weightUnit} action={<SignInToSave />} />
      </Frame>
    )
  }

  return (
    <StandaloneContext.Provider value={true}>
      <Switch>
        <Route path="/">
          <Home />
        </Route>
        <Route path="/sources">
          <PublicPage>
            <SourcesScreen />
          </PublicPage>
        </Route>
        <Route path="/privacy">
          <PublicPage>
            <PrivacyScreen />
          </PublicPage>
        </Route>
        <Route path={TARGET_PATH}>{renderTarget}</Route>
        <Route path={FIRST_RUN_STEP_PATH}>
          {(params) => (
            <Frame>
              <QuestionRoute step={params.step} answers={answers} onChange={change} />
            </Frame>
          )}
        </Route>
        <Route>
          <Redirect to="/" replace />
        </Route>
      </Switch>
    </StandaloneContext.Provider>
  )
}
