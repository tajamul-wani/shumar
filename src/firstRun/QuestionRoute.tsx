import type { ComponentType } from 'react'
import { Redirect, useLocation } from 'wouter'
import { FIRST_RUN_STEPS, firstUnanswered, type FirstRunAnswers, type FirstRunStep } from '../lib/firstRun.ts'
import {
  ActivityQuestion,
  AgeQuestion,
  GoalQuestion,
  HeightQuestion,
  SexQuestion,
  WeightQuestion,
  type QuestionProps,
} from './Questions.tsx'
import { TARGET_PATH, stepPath } from './paths.ts'

const QUESTIONS: Record<FirstRunStep, ComponentType<QuestionProps>> = {
  age: AgeQuestion,
  sex: SexQuestion,
  weight: WeightQuestion,
  height: HeightQuestion,
  activity: ActivityQuestion,
  goal: GoalQuestion,
}

function isStep(value: string): value is FirstRunStep {
  return (FIRST_RUN_STEPS as readonly string[]).includes(value)
}

interface QuestionRouteProps {
  /** The step named in the address. */
  step: string
  answers: FirstRunAnswers
  /** Keeps the answers so far. */
  onChange: (answers: FirstRunAnswers) => void
}

/**
 * One first-run question by its address. Questions are answered in order, so an address further
 * on goes back to the first one left, and the last answer leads to the daily target.
 */
export function QuestionRoute({ step, answers, onChange }: QuestionRouteProps) {
  const [, setLocation] = useLocation()
  if (!isStep(step)) return <Redirect to="/" replace />
  const missing = firstUnanswered(answers)
  if (missing && FIRST_RUN_STEPS.indexOf(missing) < FIRST_RUN_STEPS.indexOf(step)) {
    return <Redirect to={stepPath(missing)} replace />
  }
  const Question = QUESTIONS[step]
  return (
    <Question
      key={step}
      answers={answers}
      onAnswer={(given) => {
        onChange({ ...answers, ...given })
        const following = FIRST_RUN_STEPS[FIRST_RUN_STEPS.indexOf(step) + 1]
        setLocation(following ? stepPath(following) : TARGET_PATH)
      }}
      onChange={(given) => onChange({ ...answers, ...given })}
    />
  )
}
