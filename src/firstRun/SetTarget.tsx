import { useState } from 'react'
import { Redirect, useLocation } from 'wouter'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { NO_ANSWERS, firstUnanswered, toProfile, type FirstRunAnswers } from '../lib/firstRun.ts'
import { ProfileError } from '../lib/profile.ts'
import { useProfile } from '../profile/context.ts'
import { QuestionRoute } from './QuestionRoute.tsx'
import { TargetScreen } from './TargetScreen.tsx'
import { stepPath } from './paths.ts'

/**
 * The first-run questions for someone signed in, to set or change their daily target. The
 * answers being changed live in the profile context until they are saved. Until the saved
 * answers load there is nothing to show, so a reload never jumps back to the first question.
 */
function useEditedAnswers(): FirstRunAnswers | null {
  const { answers, editing, status } = useProfile()
  if (status === 'loading') return null
  return editing ?? answers ?? NO_ANSWERS
}

export function SetTargetQuestion({ step }: { step: string }) {
  const { edit } = useProfile()
  const answers = useEditedAnswers()
  if (!answers) return null
  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <QuestionRoute step={step} answers={answers} onChange={edit} />
    </div>
  )
}

function SaveTarget({ answers }: { answers: FirstRunAnswers }) {
  const { save, edit } = useProfile()
  const [, navigate] = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      await save(answers)
      edit(null)
      navigate('/')
    } catch (failure) {
      setError(
        failure instanceof ProfileError
          ? failure.message
          : "We couldn't save your answers. Check your connection and try again.",
      )
      setBusy(false)
    }
  }

  return (
    <>
      <Button onClick={handleSave} disabled={busy} className="w-full">
        {busy ? 'Saving' : 'Save my target'}
      </Button>
      {error && <Alert>{error}</Alert>}
    </>
  )
}

export function SetTargetReview() {
  const answers = useEditedAnswers()
  if (!answers) return null
  const profile = toProfile(answers)
  if (!profile) return <Redirect to={stepPath(firstUnanswered(answers) ?? 'age')} replace />
  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <TargetScreen
        profile={profile}
        weightUnit={answers.weightUnit}
        action={<SaveTarget answers={answers} />}
      />
    </div>
  )
}
