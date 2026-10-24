import { useId } from 'react'
import { Link } from 'wouter'
import { buttonClass } from '../components/buttonStyles.ts'
import { NO_ANSWERS } from '../lib/firstRun.ts'
import { useProfile } from '../profile/context.ts'
import { stepPath } from './paths.ts'

/** The way into the questions that set a daily target, for someone signed in without answers. */
export function SetTargetPrompt() {
  const { edit } = useProfile()
  return (
    <>
      <p className="m-0 text-body-sm text-koshur-muted">
        Answer six quick questions to see how much to eat each day.
      </p>
      <Link
        href={stepPath('age')}
        onClick={() => edit(NO_ANSWERS)}
        className={buttonClass('primary', 'small')}
      >
        Set my target
      </Link>
    </>
  )
}

/** Today's card for someone signed in without a daily target. */
export function SetTargetCard() {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col items-start gap-3 rounded-2xl border border-koshur-border bg-koshur-surface p-5 lg:px-6"
    >
      <h2 id={headingId} className="m-0 text-title font-semibold">
        Set your daily target
      </h2>
      <SetTargetPrompt />
    </section>
  )
}
