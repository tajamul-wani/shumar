import { Info } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Alert } from '../components/Alert.tsx'
import { Chip } from '../components/Chip.tsx'
import { RadioCard } from '../components/RadioCard.tsx'
import {
  ACTIVITY_CHOICES,
  DEFAULT_LOSS_RATE,
  GOAL_CHOICES,
  LOSS_RATES,
  SEX_CHOICES,
  checkAge,
  checkHeight,
  checkWeight,
  speedLabel,
  weightHint,
  weightInUnit,
  type FirstRunAnswers,
  type GoalKind,
  type WeightUnit,
} from '../lib/firstRun.ts'
import {
  LOSS_DEFICIT_KCAL,
  PROFILE_LIMITS,
  type ActivityLevel,
  type Goal,
  type LossRate,
  type Sex,
} from '../lib/targets.ts'
import { NumberField } from './NumberField.tsx'
import { Question, StepLayout } from './StepLayout.tsx'

export interface QuestionProps {
  answers: FirstRunAnswers
  /** Saves the answer and moves on to the next question. */
  onAnswer: (answer: Partial<FirstRunAnswers>) => void
  /** Saves a setting without moving on, such as the weight unit. */
  onChange: (answer: Partial<FirstRunAnswers>) => void
}

const CHOOSE_ONE = 'Choose one to go on.'

function focusField(id: string): void {
  document.getElementById(id)?.focus()
}

function ChoiceGroup({ titleId, children }: { titleId: string; children: ReactNode }) {
  return (
    <fieldset aria-labelledby={titleId} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      {children}
    </fieldset>
  )
}

export function AgeQuestion({ answers, onAnswer }: QuestionProps) {
  const [text, setText] = useState(answers.ageYears?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const { min, max } = PROFILE_LIMITS.ageYears

  function next() {
    const checked = checkAge(text)
    if (!checked.ok) {
      setError(checked.message)
      focusField('age')
      return
    }
    onAnswer({ ageYears: checked.value })
  }

  return (
    <StepLayout step="age" screenName="Age" onContinue={next}>
      <Question id="age-title" title="How old are you?">
        Your age changes how much energy your body uses at rest.
      </Question>
      <NumberField
        id="age"
        label="Age"
        value={text}
        onChange={(value) => {
          setText(value)
          setError(null)
        }}
        suffix="years"
        hint={`From ${min} to ${max}.`}
        error={error}
        inputMode="numeric"
      />
    </StepLayout>
  )
}

export function SexQuestion({ answers, onAnswer }: QuestionProps) {
  const [sex, setSex] = useState<Sex | undefined>(answers.sex)
  const [error, setError] = useState<string | null>(null)

  return (
    <StepLayout
      step="sex"
      screenName="Sex"
      onContinue={() => (sex ? onAnswer({ sex }) : setError(CHOOSE_ONE))}
    >
      <Question id="sex-title" title="What is your sex?">
        The formula for resting energy is different for women and men.
      </Question>
      <ChoiceGroup titleId="sex-title">
        {SEX_CHOICES.map((choice) => (
          <RadioCard
            key={choice.id}
            name="sex"
            value={choice.id}
            label={choice.label}
            checked={sex === choice.id}
            onChange={() => {
              setSex(choice.id)
              setError(null)
            }}
          />
        ))}
        {error && <Alert>{error}</Alert>}
      </ChoiceGroup>
      <p className="m-0 flex items-start gap-1.5 text-caption text-koshur-muted">
        <Info aria-hidden="true" size={12} strokeWidth={2} className="mt-0.5 size-3 shrink-0" />
        Pregnant or breastfeeding? These targets aren't made for that time. Your doctor can tell you what you
        need.
      </p>
    </StepLayout>
  )
}

export function WeightQuestion({ answers, onAnswer, onChange }: QuestionProps) {
  const [unit, setUnit] = useState<WeightUnit>(answers.weightUnit)
  const [text, setText] = useState(
    answers.weightKg === undefined ? '' : weightInUnit(answers.weightKg, answers.weightUnit),
  )
  const [error, setError] = useState<string | null>(null)

  function switchUnit(to: WeightUnit) {
    if (to === unit) return
    // Carry over a weight already typed, in the new unit.
    const typed = checkWeight(text, unit)
    if (typed.ok) setText(weightInUnit(typed.value, to))
    setUnit(to)
    setError(null)
    onChange({ weightUnit: to })
  }

  function next() {
    const checked = checkWeight(text, unit)
    if (!checked.ok) {
      setError(checked.message)
      focusField('weight')
      return
    }
    onAnswer({ weightKg: checked.value, weightUnit: unit })
  }

  return (
    <StepLayout step="weight" screenName="Weight" onContinue={next}>
      <Question id="weight-title" title="What do you weigh?">
        A rough number is fine. You can change it any time on the You screen.
      </Question>
      <NumberField
        id="weight"
        label="Weight"
        value={text}
        onChange={(value) => {
          setText(value)
          setError(null)
        }}
        suffix={unit}
        hint={weightHint(unit)}
        error={error}
        inputMode="decimal"
        aside={
          <fieldset className="m-0 flex min-w-0 gap-2 border-0 p-0">
            <legend className="sr-only">Weight unit</legend>
            {(['kg', 'lb'] as const).map((option) => (
              <Chip
                key={option}
                pressed={unit === option}
                onClick={() => switchUnit(option)}
                className="min-w-14"
              >
                {option}
              </Chip>
            ))}
          </fieldset>
        }
      />
    </StepLayout>
  )
}

export function HeightQuestion({ answers, onAnswer }: QuestionProps) {
  const [text, setText] = useState(answers.heightCm?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const { min, max } = PROFILE_LIMITS.heightCm

  function next() {
    const checked = checkHeight(text)
    if (!checked.ok) {
      setError(checked.message)
      focusField('height')
      return
    }
    onAnswer({ heightCm: checked.value })
  }

  return (
    <StepLayout step="height" screenName="Height" onContinue={next}>
      <Question id="height-title" title="How tall are you?">
        Your height and weight together give your body size.
      </Question>
      <NumberField
        id="height"
        label="Height"
        value={text}
        onChange={(value) => {
          setText(value)
          setError(null)
        }}
        suffix="cm"
        hint={`From ${min} to ${max} cm.`}
        error={error}
        inputMode="decimal"
      />
    </StepLayout>
  )
}

export function ActivityQuestion({ answers, onAnswer }: QuestionProps) {
  const [activity, setActivity] = useState<ActivityLevel | undefined>(answers.activity)
  const [error, setError] = useState<string | null>(null)

  return (
    <StepLayout
      step="activity"
      screenName="Activity"
      onContinue={() => (activity ? onAnswer({ activity }) : setError(CHOOSE_ONE))}
    >
      <Question id="activity-title" title="How active are you on most days?">
        Count your work and your exercise together.
      </Question>
      <ChoiceGroup titleId="activity-title">
        {ACTIVITY_CHOICES.map((choice) => (
          <RadioCard
            key={choice.id}
            name="activity"
            value={choice.id}
            label={choice.label}
            detail={choice.detail}
            checked={activity === choice.id}
            onChange={() => {
              setActivity(choice.id)
              setError(null)
            }}
          />
        ))}
        {error && <Alert>{error}</Alert>}
      </ChoiceGroup>
    </StepLayout>
  )
}

interface GoalQuestionProps extends QuestionProps {
  continueLabel: string
  busy?: boolean
  /** A problem with what comes after the last question, such as sign-in failing to start. */
  finishError?: string | null
}

export function GoalQuestion({ answers, onAnswer, continueLabel, busy, finishError }: GoalQuestionProps) {
  const [kind, setKind] = useState<GoalKind | undefined>(answers.goal?.kind)
  const [rate, setRate] = useState<LossRate>(
    answers.goal?.kind === 'lose' ? answers.goal.kgPerWeek : DEFAULT_LOSS_RATE,
  )
  const [error, setError] = useState<string | null>(null)

  function next() {
    if (!kind) {
      setError(CHOOSE_ONE)
      return
    }
    const goal: Goal = kind === 'lose' ? { kind, kgPerWeek: rate } : { kind }
    onAnswer({ goal })
  }

  return (
    <StepLayout step="goal" screenName="Goal" continueLabel={continueLabel} busy={busy} onContinue={next}>
      <Question id="goal-title" title="What is your goal?">
        You can change it any time.
      </Question>
      <ChoiceGroup titleId="goal-title">
        {GOAL_CHOICES.map((choice) => (
          <RadioCard
            key={choice.id}
            name="goal"
            value={choice.id}
            label={choice.label}
            detail={choice.detail}
            checked={kind === choice.id}
            onChange={() => {
              setKind(choice.id)
              setError(null)
            }}
          />
        ))}
        {error && <Alert>{error}</Alert>}
      </ChoiceGroup>
      {kind === 'lose' && (
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="p-0 pb-2 text-body-sm text-koshur-muted">How fast?</legend>
          <div className="flex flex-wrap gap-2">
            {LOSS_RATES.map((option) => (
              <Chip key={option} pressed={rate === option} onClick={() => setRate(option)}>
                {speedLabel(option, answers.weightUnit)}
              </Chip>
            ))}
          </div>
          <p className="m-0 text-body-sm text-koshur-muted">
            About {LOSS_DEFICIT_KCAL[rate]} kcal a day less than you burn.
          </p>
        </fieldset>
      )}
      {finishError && <Alert>{finishError}</Alert>}
    </StepLayout>
  )
}
