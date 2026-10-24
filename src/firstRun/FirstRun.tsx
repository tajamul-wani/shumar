import { useEffect, useRef, useState } from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'
import {
  firstUnanswered,
  readAnswers,
  saveAnswers,
  toProfile,
  type FirstRunAnswers,
} from '../lib/firstRun.ts'
import { FIRST_RUN_STEP_PATH, TARGET_PATH, stepPath } from './paths.ts'
import { QuestionRoute } from './QuestionRoute.tsx'
import { SignInToSave } from './SignInToSave.tsx'
import { StandaloneContext } from './standalone.ts'
import { TargetScreen } from './TargetScreen.tsx'
import { Welcome } from './Welcome.tsx'

/**
 * Everything a signed-out visitor sees: the welcome screen, the first-run questions and the
 * daily target they lead to. Answers are kept on this device as they are given, so a reload
 * or a step back keeps them.
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
    return <TargetScreen profile={profile} weightUnit={answers.weightUnit} action={<SignInToSave />} />
  }

  return (
    <StandaloneContext.Provider value={true}>
      <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-3 pb-8 lg:pt-8">
        <Switch>
          <Route path="/">
            <Welcome />
          </Route>
          <Route path={TARGET_PATH}>{renderTarget}</Route>
          <Route path={FIRST_RUN_STEP_PATH}>
            {(params) => <QuestionRoute step={params.step} answers={answers} onChange={change} />}
          </Route>
          <Route>
            <Redirect to="/" replace />
          </Route>
        </Switch>
      </main>
    </StandaloneContext.Provider>
  )
}
