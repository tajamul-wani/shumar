import { useContext, type ReactNode } from 'react'
import { buttonClass } from '../components/buttonStyles.ts'
import { FIRST_RUN_STEPS, type FirstRunStep } from '../lib/firstRun.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'
import { BackLink } from './BackLink.tsx'
import { stepPath } from './paths.ts'
import { StandaloneContext } from './standalone.ts'

interface StepLayoutProps {
  step: FirstRunStep
  /** The short name for the browser tab, such as "Age". */
  screenName: string
  continueLabel?: string
  busy?: boolean
  onContinue: () => void
  children: ReactNode
}

/**
 * One first-run question: Back, how far along it is, the question, and a button to go on.
 * It's a real form, so Enter goes on too.
 */
export function StepLayout({
  step,
  screenName,
  continueLabel = 'Continue',
  busy = false,
  onContinue,
  children,
}: StepLayoutProps) {
  useDocumentTitle(screenName)
  const standalone = useContext(StandaloneContext)
  const index = FIRST_RUN_STEPS.indexOf(step)
  const back = index === 0 ? '/' : stepPath(FIRST_RUN_STEPS[index - 1])
  const total = FIRST_RUN_STEPS.length

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onContinue()
      }}
      className="flex flex-1 flex-col justify-between gap-6 lg:flex-none lg:justify-start"
    >
      <div className="flex flex-col gap-6">
        {standalone && (
          <p className="m-0 hidden items-center gap-3 lg:flex">
            <span lang="ks" className="font-wordmark text-title text-deficit-ring">
              شُمار
            </span>
            <span className="text-body font-semibold">Shumār</span>
          </p>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <BackLink href={back} />
            <span className="text-body-sm text-koshur-muted">
              <span className="sr-only">Question </span>
              {index + 1} of {total}
            </span>
          </div>
          <div aria-hidden="true" className="grid grid-cols-6 gap-1">
            {FIRST_RUN_STEPS.map((s, i) => (
              <span
                key={s}
                className={`h-1 rounded-full ${i <= index ? 'bg-deficit-ring' : 'bg-koshur-border'}`}
              />
            ))}
          </div>
        </div>
        {children}
      </div>
      <button type="submit" disabled={busy} className={buttonClass('primary', 'large', 'w-full')}>
        {continueLabel}
      </button>
    </form>
  )
}

/** The question itself: a heading that takes focus when the screen opens, and a line under it. */
export function Question({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 id={id} tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none">
        {title}
      </h1>
      {children && <p className="m-0 text-body text-koshur-muted">{children}</p>}
    </div>
  )
}
