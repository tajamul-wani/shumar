import { ChevronDown, Info, Lock } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { MacroTargets } from '../components/MacroTargets.tsx'
import { formatNumber } from '../lib/foodDisplay.ts'
import { floorNote, goalAim, type WeightUnit } from '../lib/firstRun.ts'
import { dailyTargets, type Profile } from '../lib/targets.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'
import { AnswerList } from './AnswerList.tsx'
import { BackLink } from './BackLink.tsx'
import { stepPath } from './paths.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

function HowItWorks() {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={`-ml-1 flex min-h-11 items-center gap-1 self-start rounded-xl px-1 text-body-sm font-semibold text-deficit-ring ${FOCUS_RING}`}
      >
        How this is worked out
        <ChevronDown
          aria-hidden="true"
          size={16}
          strokeWidth={2}
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul id={panelId} className="m-0 flex list-none flex-col gap-2 p-0 text-body-sm text-koshur-muted">
          <li>
            <span className="font-semibold text-koshur-silk">Resting energy:</span> the Mifflin-St Jeor
            formula (1990), from your age, sex, height and weight.
          </li>
          <li>
            <span className="font-semibold text-koshur-silk">Daily energy:</span> resting energy times your
            activity level, from FAO/WHO/UNU (2004) and, for sedentary, ICMR-NIN (2020).
          </li>
          <li>
            <span className="font-semibold text-koshur-silk">Your goal:</span> 300, 500 or 750 kcal less a day
            to lose about 0.25, 0.5 or 0.75 kg a week (NIH 1998, AHA/ACC/TOS 2013), or 10% more to gain (Iraki
            and others, 2019). Never below 1,200 kcal a day for women or 1,500 for men.
          </li>
          <li>
            <span className="font-semibold text-koshur-silk">Protein, carbs and fat:</span> 1.6 g of protein
            for each kg you weigh, or 2.2 g for body recomposition, and at most 35% of calories (Morton and
            others 2018, ISSN 2017, IOM 2005). Fat is 25% of calories (IOM 2005, WHO), and carbs are the rest.
          </li>
        </ul>
      )}
    </div>
  )
}

interface TargetScreenProps {
  profile: Profile
  weightUnit: WeightUnit
  /** What saves the target: signing in before sign-in, or saving to the profile after. */
  action: ReactNode
}

/** The daily target worked out from the first-run answers, with a way to keep it. */
export function TargetScreen({ profile, weightUnit, action }: TargetScreenProps) {
  useDocumentTitle('Your daily target')
  const targets = dailyTargets(profile)
  const note = floorNote(targets, profile.sex)

  return (
    <div className="flex flex-1 flex-col justify-between gap-6 lg:flex-none lg:justify-start">
      <div className="flex flex-col gap-4">
        <BackLink href={stepPath('goal')} />
        <h1 tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none">
          Your daily target
        </h1>

        <section
          aria-label="Daily target"
          className="flex flex-col gap-4 rounded-2xl border border-koshur-border bg-koshur-surface p-5"
        >
          <p className="m-0 flex flex-col gap-1">
            <span className="text-body-sm text-koshur-muted">Calories a day</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-display font-semibold text-koshur-silk">
                {formatNumber(targets.kcal)}
              </span>
              <span className="text-body-sm text-koshur-muted">kcal</span>
            </span>
          </p>
          <p className="m-0 text-body-sm text-koshur-muted">
            Worked out from your answers {goalAim(profile.goal, weightUnit)}, using the Mifflin-St Jeor
            formula.
          </p>
          {note && (
            <p className="m-0 flex items-start gap-2 text-body-sm text-koshur-silk">
              <Info
                aria-hidden="true"
                size={16}
                strokeWidth={2}
                className="mt-0.5 size-4 shrink-0 text-koshur-muted"
              />
              {note}
            </p>
          )}
          <HowItWorks />
          <MacroTargets targets={targets} />
        </section>

        <section
          aria-labelledby="answers-title"
          className="overflow-hidden rounded-2xl border border-koshur-border bg-koshur-surface"
        >
          <div className="flex items-center justify-between px-5 py-2">
            <h2 id="answers-title" className="m-0 text-body font-semibold">
              Your answers
            </h2>
            <Link
              href={stepPath('age')}
              className={`flex min-h-11 items-center rounded-xl px-1 text-body-sm font-semibold text-deficit-ring ${FOCUS_RING}`}
            >
              Change <span className="sr-only">your answers</span>
            </Link>
          </div>
          <AnswerList profile={profile} weightUnit={weightUnit} />
        </section>
      </div>

      <div className="flex flex-col gap-3">
        {action}
        <p className="m-0 flex items-start justify-center gap-1.5 text-caption text-koshur-muted">
          <Lock aria-hidden="true" size={12} strokeWidth={2} className="mt-0.5 size-3 shrink-0" />
          Your targets and food logs are private. Only you can see them.
        </p>
      </div>
    </div>
  )
}
