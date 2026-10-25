import { ChevronRight, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { useAuth } from '../auth/context.ts'
import { Alert } from '../components/Alert.tsx'
import { Button } from '../components/Button.tsx'
import { buttonClass } from '../components/buttonStyles.ts'
import { MacroTargets } from '../components/MacroTargets.tsx'
import { stepPath } from '../firstRun/paths.ts'
import { SetTargetPrompt } from '../firstRun/SetTargetCard.tsx'
import { summarizeAccount, type AccountUser } from '../lib/account.ts'
import { buildExport, confirmsDeletion, deleteAccount, exportFileName, saveFile } from '../lib/accountData.ts'
import { signOut } from '../lib/auth.ts'
import { fetchAllLogs } from '../lib/dayLogs.ts'
import { formatNumber } from '../lib/foodDisplay.ts'
import {
  ANSWER_LABELS,
  answerValues,
  floorNote,
  goalAim,
  toProfile,
  type FirstRunStep,
} from '../lib/firstRun.ts'
import { dailyTargets } from '../lib/targets.ts'
import { useProfile } from '../profile/context.ts'
import { PREFERENCES, PREFERENCE_LABELS, type ThemePreference } from '../lib/theme.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'
import { DESKTOP_QUERY, useMediaQuery } from '../shell/useMediaQuery.ts'
import { useTheme } from '../theme/context.ts'

const CARD = 'rounded-2xl border border-koshur-border bg-koshur-surface'

/** "phone" on phones and tablets, "computer" from 1024 px up, as the design words it. */
function Device() {
  return (
    <>
      <span className="lg:hidden">phone</span>
      <span className="hidden lg:inline">computer</span>
    </>
  )
}

function PreferenceHint({ preference }: { preference: ThemePreference }) {
  if (preference === 'light') {
    return (
      <>
        Always light, whatever your <Device /> uses.
      </>
    )
  }
  if (preference === 'dark') return <>Always dark, easier on the eyes at night.</>
  return (
    <>
      Follows your <Device />.
    </>
  )
}

function Appearance() {
  const { preference, setPreference } = useTheme()
  return (
    <section aria-labelledby="appearance-heading" className={`${CARD} flex min-w-0 flex-col gap-3 p-5`}>
      <h2 id="appearance-heading" className="m-0 text-body font-semibold">
        Appearance
      </h2>
      <fieldset className="m-0 grid min-w-0 grid-cols-3 rounded-xl border border-koshur-border bg-koshur-base p-1">
        <legend className="sr-only">Theme</legend>
        {PREFERENCES.map((option) => {
          const pressed = option === preference
          return (
            <button
              key={option}
              type="button"
              aria-pressed={pressed}
              onClick={() => setPreference(option)}
              className={`min-h-11 rounded-lg text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring ${
                pressed ? 'bg-koshur-surface font-semibold text-koshur-silk' : 'font-medium text-koshur-muted'
              }`}
            >
              {PREFERENCE_LABELS[option]}
            </button>
          )
        })}
      </fieldset>
      <p className="m-0 text-body-sm text-koshur-muted">
        <PreferenceHint preference={preference} />
      </p>
    </section>
  )
}

const ABOUT_LINK =
  'flex min-h-13 items-start justify-between gap-3 border-t border-koshur-border px-5 py-3.5 text-body text-koshur-silk transition-colors hover:bg-koshur-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring focus-visible:ring-inset lg:min-h-12 lg:text-body-sm'

function About() {
  const chevron = (
    <ChevronRight
      aria-hidden="true"
      size={20}
      strokeWidth={2}
      className="mt-1 size-4 shrink-0 text-koshur-muted sm:mt-0.5 sm:size-5 lg:hidden"
    />
  )
  return (
    <section aria-labelledby="about-heading" className={`${CARD} min-w-0 overflow-hidden`}>
      <h2 id="about-heading" className="m-0 px-5 pt-4 pb-2 text-body font-semibold">
        About
      </h2>
      <Link href="/sources" className={ABOUT_LINK}>
        Where food values come from
        {chevron}
      </Link>
      <Link href="/privacy" className={ABOUT_LINK}>
        Privacy policy
        {chevron}
      </Link>
      <p className="m-0 border-t border-koshur-border px-5 pt-3 pb-4 text-caption text-koshur-muted">
        Ingredient values from USDA FoodData Central, in the public domain. Shumār 0.1
      </p>
    </section>
  )
}

/** The two things the privacy policy promises: a file of everything, and the end of the account. */
function YourDataCard({ user, onDeleted }: { user: AccountUser; onDeleted: () => void }) {
  const { client } = useAuth()
  const { answers } = useProfile()
  const [busy, setBusy] = useState<'download' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const confirmId = useId()
  const ready = confirmsDeletion(typed)

  function open(next: boolean) {
    setTyped('')
    setConfirming(next)
  }

  async function handleDownload() {
    setBusy('download')
    setError(null)
    try {
      const logs = await fetchAllLogs(client)
      const now = new Date()
      saveFile(exportFileName(now), JSON.stringify(buildExport(user, answers, logs, now), null, 2))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't prepare your file. Try again.")
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete() {
    if (!ready) return
    setBusy('delete')
    setError(null)
    try {
      await deleteAccount(client)
      onDeleted()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't delete your account. Try again.")
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="your-data-heading" className={`${CARD} flex min-w-0 flex-col gap-3 p-5`}>
      <h2 id="your-data-heading" className="m-0 text-body font-semibold">
        Your data
      </h2>
      <p className="m-0 text-body-sm text-koshur-muted">
        Your answers, your target and every log, as one file you can keep or move elsewhere.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="small" onClick={handleDownload} disabled={busy !== null}>
          {busy === 'download' ? 'Preparing your file' : 'Download my data'}
        </Button>
        {!confirming && (
          <Button variant="secondary" size="small" onClick={() => open(true)} disabled={busy !== null}>
            Delete my account
          </Button>
        )}
      </div>
      {confirming && (
        <section
          aria-labelledby="delete-heading"
          className="flex flex-col gap-3 rounded-xl border border-alert-surplus bg-koshur-base p-4"
        >
          <p id="delete-heading" className="m-0 flex items-start gap-2 text-body font-semibold">
            <TriangleAlert
              aria-hidden="true"
              size={20}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-alert-surplus"
            />
            Delete your account and every log?
          </p>
          <p className="m-0 text-body-sm text-koshur-muted">
            This cannot be undone. Your account, your answers and all your food logs go straight away, and
            nothing is kept. Download your data first if you want it.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={confirmId} className="text-body-sm font-medium text-koshur-silk">
              Type <span className="font-semibold">delete</span> to confirm
            </label>
            <input
              id={confirmId}
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={busy !== null}
              className="h-11 w-full max-w-xs rounded-xl border border-koshur-border bg-koshur-surface px-4 text-body text-koshur-silk focus:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="inset" size="small" onClick={handleDelete} disabled={!ready || busy !== null}>
              {busy === 'delete' ? 'Deleting' : 'Yes, delete everything'}
            </Button>
            <Button variant="secondary" size="small" onClick={() => open(false)} disabled={busy !== null}>
              Keep my account
            </Button>
          </div>
        </section>
      )}
      {error && <Alert>{error}</Alert>}
    </section>
  )
}

/** The daily target, as the approved You design shows it, or what stands in for it. */
function TargetCard({ wide }: { wide: boolean }) {
  const { answers, status, error, reload, edit } = useProfile()
  const headingId = useId()
  if (status === 'loading') {
    return (
      <>
        <output className="sr-only">Loading your target</output>
        <div aria-hidden="true" className={`h-48 ${CARD}`} />
      </>
    )
  }
  const heading = (
    <h2 id={headingId} className="m-0 text-body-sm font-medium text-koshur-muted">
      Daily target
    </h2>
  )
  const profile = answers && toProfile(answers)
  if (!answers || !profile) {
    return (
      <section aria-labelledby={headingId} className={`${CARD} flex flex-col items-start gap-3 p-5`}>
        {heading}
        {status === 'error' ? (
          <>
            <Alert>{error}</Alert>
            <Button variant="secondary" size="small" onClick={reload}>
              Try again
            </Button>
          </>
        ) : (
          <SetTargetPrompt />
        )}
      </section>
    )
  }
  const targets = dailyTargets(profile)
  const note = floorNote(targets, profile.sex)
  return (
    <section aria-labelledby={headingId} className={`${CARD} flex flex-col gap-4 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          {heading}
          <p className="m-0 flex items-baseline gap-1.5">
            <span className="text-display font-semibold text-koshur-silk">{formatNumber(targets.kcal)}</span>
            <span className="text-body-sm text-koshur-muted">kcal</span>
          </p>
        </div>
        {/* The design says "Adjust" on phones, where space is short, and "Adjust target" on wide screens. */}
        <Link
          href={stepPath('age')}
          onClick={() => edit(answers)}
          aria-label={wide ? undefined : 'Adjust target'}
          className={buttonClass(wide ? 'primary' : 'inset', 'small', 'shrink-0')}
        >
          {wide ? 'Adjust target' : 'Adjust'}
        </Link>
      </div>
      <p className="m-0 text-body-sm text-koshur-muted">
        Set from your details {goalAim(profile.goal, answers.weightUnit)}, using the Mifflin-St Jeor formula.
        You can change it any time.
      </p>
      {note && <p className="m-0 text-body-sm text-koshur-silk">{note}</p>}
      <MacroTargets targets={targets} />
    </section>
  )
}

/** The design's order, with sex and goal beside the answers they belong with. */
const DETAIL_ORDER: readonly FirstRunStep[] = ['height', 'weight', 'age', 'sex', 'activity', 'goal']

/** The answers behind the target. Each row opens its question, filled in, to change it. */
function DetailsCard() {
  const { answers, edit } = useProfile()
  const headingId = useId()
  const profile = answers && toProfile(answers)
  if (!answers || !profile) return null
  const values = answerValues(profile, answers.weightUnit)
  const rows = [
    ...DETAIL_ORDER.map((step) => ({ step, label: ANSWER_LABELS[step], value: values[step] })),
    // Weight is the question where the unit is chosen.
    { step: 'weight' as const, label: 'Units', value: `${answers.weightUnit}, cm` },
  ]
  return (
    <section aria-labelledby={headingId} className={`${CARD} min-w-0 overflow-hidden`}>
      <h2 id={headingId} className="m-0 px-5 pt-4 pb-2 text-body font-semibold">
        Your details
      </h2>
      {rows.map((row) => (
        <Link
          key={row.label}
          href={stepPath(row.step)}
          onClick={() => edit(answers)}
          className="flex min-h-13 items-start justify-between gap-3 border-t border-koshur-border px-5 py-3.5 text-body text-koshur-silk transition-colors hover:bg-koshur-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring focus-visible:ring-inset lg:min-h-12 lg:text-body-sm"
        >
          <span>{row.label}</span>{' '}
          <span className="mt-0.5 flex items-start gap-1.5 text-right text-body-sm text-koshur-muted lg:mt-0">
            {row.value}
            <ChevronRight
              aria-hidden="true"
              size={20}
              strokeWidth={2}
              className="mt-0.5 size-4 shrink-0 sm:mt-0 sm:size-5 lg:hidden"
            />
          </span>
        </Link>
      ))}
    </section>
  )
}

export function YouScreen({ user }: { user: AccountUser }) {
  useDocumentTitle('You')
  const { client } = useAuth()
  const [, navigate] = useLocation()
  const { name, detail, initial } = summarizeAccount(user)
  const wide = useMediaQuery(DESKTOP_QUERY)

  async function handleSignOut() {
    // The device is cleared even if this fails, so there is nothing more to do on an error.
    await signOut(client).catch(() => undefined)
    navigate('/', { replace: true })
  }

  const yourData = <YourDataCard user={user} onDeleted={handleSignOut} />

  const account = (
    <section aria-label="Account" className={`${CARD} flex min-w-0 items-start gap-3.5 px-5 py-4`}>
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-full border border-koshur-border bg-koshur-base text-title font-semibold text-deficit-ring"
      >
        {initial}
      </span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-body font-semibold wrap-anywhere">{name}</span>
        {detail && <span className="text-body-sm text-koshur-muted wrap-anywhere">{detail}</span>}
      </span>
      {/* A wrapper hides it on phones: the button's own display class would win over "hidden". */}
      <div className="hidden shrink-0 self-center lg:block">
        <Button variant="secondary" size="small" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </section>
  )

  return (
    <>
      <h1 tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none">
        You
      </h1>
      {/* Phones follow the design's single column; wide screens put the settings in a second one. */}
      {wide ? (
        <div className="grid grid-cols-2 items-start gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            {account}
            <TargetCard wide />
            <DetailsCard />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <Appearance />
            {yourData}
            <About />
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {account}
          <TargetCard wide={false} />
          <Appearance />
          <DetailsCard />
          {yourData}
          <About />
        </div>
      )}
      <Button variant="secondary" className="w-full lg:hidden" onClick={handleSignOut}>
        Sign out
      </Button>
    </>
  )
}
