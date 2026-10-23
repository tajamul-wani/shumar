import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'
import { useAuth } from '../auth/context.ts'
import { signInWithGoogle } from '../lib/auth.ts'
import {
  FIRST_RUN_STEPS,
  firstUnanswered,
  readAnswers,
  saveAnswers,
  type FirstRunAnswers,
  type FirstRunStep,
} from '../lib/firstRun.ts'
import {
  ActivityQuestion,
  AgeQuestion,
  GoalQuestion,
  HeightQuestion,
  SexQuestion,
  WeightQuestion,
  type QuestionProps,
} from './Questions.tsx'
import { FIRST_RUN_STEP_PATH, stepPath } from './paths.ts'
import { Welcome } from './Welcome.tsx'

const QUESTIONS: Record<Exclude<FirstRunStep, 'goal'>, ComponentType<QuestionProps>> = {
  age: AgeQuestion,
  sex: SexQuestion,
  weight: WeightQuestion,
  height: HeightQuestion,
  activity: ActivityQuestion,
}

function isStep(value: string): value is FirstRunStep {
  return (FIRST_RUN_STEPS as readonly string[]).includes(value)
}

/**
 * Everything a signed-out visitor sees: the welcome screen and the first-run questions.
 * Answers are kept on this device as they are given, so a reload or a step back keeps them.
 */
export function FirstRun() {
  const { client } = useAuth()
  const [answers, setAnswers] = useState<FirstRunAnswers>(() => readAnswers())
  const [location, setLocation] = useLocation()
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)

  // After moving to another screen, put keyboard and screen reader focus on its heading.
  const previousLocation = useRef(location)
  useEffect(() => {
    if (previousLocation.current === location) return
    previousLocation.current = location
    document.querySelector<HTMLElement>('#main h1')?.focus()
  }, [location])

  function change(given: Partial<FirstRunAnswers>): FirstRunAnswers {
    const next = { ...answers, ...given }
    setAnswers(next)
    saveAnswers(next)
    return next
  }

  async function signIn() {
    setSigningIn(true)
    setSignInError(null)
    try {
      await signInWithGoogle(client)
    } catch {
      setSignInError("We couldn't start Google sign-in. Check your connection and try again.")
      setSigningIn(false)
    }
  }

  function answer(step: FirstRunStep, given: Partial<FirstRunAnswers>) {
    change(given)
    const following = FIRST_RUN_STEPS[FIRST_RUN_STEPS.indexOf(step) + 1]
    if (following) setLocation(stepPath(following))
    else void signIn()
  }

  function renderStep(value: string) {
    if (!isStep(value)) return <Redirect to="/" replace />
    // Questions are answered in order: an address further on goes back to the first one left.
    const missing = firstUnanswered(answers)
    if (missing && FIRST_RUN_STEPS.indexOf(missing) < FIRST_RUN_STEPS.indexOf(value)) {
      return <Redirect to={stepPath(missing)} replace />
    }
    const props: QuestionProps = {
      answers,
      onAnswer: (given) => answer(value, given),
      onChange: change,
    }
    if (value === 'goal') {
      return (
        <GoalQuestion
          {...props}
          continueLabel={signingIn ? 'Opening Google' : 'Sign in with Google to save'}
          busy={signingIn}
          finishError={signInError}
        />
      )
    }
    const QuestionScreen = QUESTIONS[value]
    return <QuestionScreen key={value} {...props} />
  }

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-3 pb-8 lg:pt-8">
      <Switch>
        <Route path="/">
          <Welcome />
        </Route>
        <Route path={FIRST_RUN_STEP_PATH}>{(params) => renderStep(params.step)}</Route>
        <Route>
          <Redirect to="/" replace />
        </Route>
      </Switch>
    </main>
  )
}
