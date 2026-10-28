import { Download, Share, SquarePlus } from 'lucide-react'
import { useId, useState, useSyncExternalStore } from 'react'
import {
  dismissInstall,
  installMode,
  isInstallDismissed,
  onInstallChange,
  promptInstall,
  type InstallMode,
} from '../lib/install.ts'
import { Button } from './Button.tsx'

const CARD = 'flex min-w-0 flex-col gap-3 rounded-2xl border border-koshur-border bg-koshur-surface p-5'
const INLINE_ICON = 'inline-block size-4 align-text-bottom text-deficit-ring'

/** What the device can offer, kept current as the browser makes or withdraws its offer. */
function useInstallMode(): InstallMode {
  return useSyncExternalStore(onInstallChange, () => installMode())
}

/** The two taps an iPhone or iPad takes in Safari, with the icons Safari shows. */
function SafariSteps() {
  return (
    <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-body-sm text-koshur-silk">
      <li>
        Tap <span className="font-semibold">Share</span>{' '}
        <Share aria-hidden="true" size={16} strokeWidth={2} className={INLINE_ICON} /> in Safari's toolbar.
      </li>
      <li>
        Choose <span className="font-semibold">Add to Home Screen</span>{' '}
        <SquarePlus aria-hidden="true" size={16} strokeWidth={2} className={INLINE_ICON} />, then{' '}
        <span className="font-semibold">Add</span>.
      </li>
    </ol>
  )
}

interface InstallCardProps {
  /**
   * Today asks once, with Not now, which hides it on this device for good. The You screen keeps
   * it there until the app is installed, so it can always be found.
   */
  place: 'today' | 'you'
  /** Such as where it shows: Today's card is for phones and tablets only. */
  className?: string
}

/**
 * The install option, as approved on 28 October 2026 (SHU-35): the browser's own install dialog in
 * one tap where the browser has one, and the two Safari steps on an iPhone or iPad. It shows only
 * while there is something to offer.
 */
export function InstallCard({ place, className = '' }: InstallCardProps) {
  const mode = useInstallMode()
  const headingId = useId()
  const [dismissed, setDismissed] = useState(() => place === 'today' && isInstallDismissed())
  const [showSteps, setShowSteps] = useState(place === 'you')
  const [busy, setBusy] = useState(false)
  if (mode === 'none' || dismissed) return null

  const today = place === 'today'
  async function install() {
    setBusy(true)
    try {
      await promptInstall()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby={headingId} className={`${CARD} ${className}`}>
      <h2 id={headingId} className="m-0 text-body font-semibold">
        {today ? 'Add Shumār to your home screen' : 'Install the app'}
      </h2>
      {mode === 'ios' && showSteps ? (
        <>
          <p className="m-0 text-body-sm text-koshur-muted">Safari adds it in two taps:</p>
          <SafariSteps />
        </>
      ) : (
        <p className="m-0 text-body-sm text-koshur-muted">
          {today
            ? 'It opens like an app, and works without a connection.'
            : 'Add Shumār to your home screen. It opens in its own window and works without a connection.'}
        </p>
      )}
      {(mode === 'prompt' || !showSteps || today) && (
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'prompt' ? (
            <Button size="small" disabled={busy} onClick={() => void install()}>
              <Download aria-hidden="true" size={20} strokeWidth={2} className="size-4" />
              {today ? 'Install' : 'Install Shumār'}
            </Button>
          ) : (
            !showSteps && (
              <Button size="small" onClick={() => setShowSteps(true)}>
                <SquarePlus aria-hidden="true" size={20} strokeWidth={2} className="size-4" />
                Show me how
              </Button>
            )
          )}
          {today && (
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                dismissInstall()
                setDismissed(true)
              }}
            >
              Not now
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
