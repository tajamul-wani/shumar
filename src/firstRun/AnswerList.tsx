import { ANSWER_LABELS, FIRST_RUN_STEPS, answerValues, type WeightUnit } from '../lib/firstRun.ts'
import type { Profile } from '../lib/targets.ts'

/** The first-run answers in the order they were asked, as the target screen shows them. */
export function AnswerList({ profile, weightUnit }: { profile: Profile; weightUnit: WeightUnit }) {
  const values = answerValues(profile, weightUnit)
  return (
    <dl className="m-0">
      {FIRST_RUN_STEPS.map((step) => (
        <div
          key={step}
          className="flex justify-between gap-4 border-t border-koshur-border px-5 py-3 text-body-sm"
        >
          <dt className="text-koshur-muted">{ANSWER_LABELS[step]}</dt>
          <dd className="m-0 text-right text-koshur-silk">{values[step]}</dd>
        </div>
      ))}
    </dl>
  )
}
