import { Copy, Download, ExternalLink, Share, SquarePlus } from 'lucide-react'
import { useId, useRef, useState, useSyncExternalStore } from 'react'
import {
  chromeLink,
  dismissInstall,
  installMode,
  isInstallDismissed,
  onInstallChange,
  promptInstall,
  type InstallMode,
} from '../lib/install.ts'
import { Button } from './Button.tsx'
import { buttonClass } from './buttonStyles.ts'
import { Toast, type ToastMessage } from './Toast.tsx'

const CARD = 'flex min-w-0 flex-col gap-3 rounded-2xl border border-koshur-border bg-koshur-surface p-5'
const INLINE_ICON = 'inline-block size-4 align-text-bottom text-deficit-ring'
const ICON = 'size-4'

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

/** The site's own address, which is where the installed app starts. */
const siteAddress = () => `${window.location.origin}/`

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
 * one tap where the browser has one, the two Safari steps on an iPhone or iPad, and in a browser
 * that can't install it, where to install it from instead. It shows only while there is something
 * to offer.
 */
export function InstallCard({ place, className = '' }: InstallCardProps) {
  const mode = useInstallMode()
  const headingId = useId()
  const [dismissed, setDismissed] = useState(() => place === 'today' && isInstallDismissed())
  const [showSteps, setShowSteps] = useState(place === 'you')
  const [busy, setBusy] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [notice, setNotice] = useState<ToastMessage | null>(null)
  const noticeId = useRef(0)
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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(siteAddress())
      noticeId.current += 1
      setNotice({ id: noticeId.current, text: 'Link copied', tone: 'added' })
    } catch {
      // Copying can be refused; the address is then shown to copy by hand.
      setCopyFailed(true)
    }
  }

  const heading =
    mode === 'elsewhere'
      ? 'Install Shumār from Chrome'
      : mode === 'ios-other'
        ? 'Install Shumār from Safari'
        : today
          ? 'Add Shumār to your home screen'
          : 'Install the app'

  const copyButton = (
    <Button variant="secondary" size="small" onClick={() => void copyLink()}>
      <Copy aria-hidden="true" size={20} strokeWidth={2} className={ICON} />
      Copy link
    </Button>
  )

  return (
    <section aria-labelledby={headingId} className={`${CARD} ${className}`}>
      <h2 id={headingId} className="m-0 text-body font-semibold">
        {heading}
      </h2>
      {mode === 'elsewhere' && (
        <p className="m-0 text-body-sm text-koshur-muted">
          This browser can't add Shumār as an app. Open this page in Chrome, then tap Install.
        </p>
      )}
      {mode === 'ios-other' && (
        <>
          <p className="m-0 text-body-sm text-koshur-muted">Open this page in Safari, then:</p>
          <SafariSteps />
        </>
      )}
      {mode === 'ios' && showSteps && (
        <>
          <p className="m-0 text-body-sm text-koshur-muted">Safari adds it in two taps:</p>
          <SafariSteps />
        </>
      )}
      {(mode === 'prompt' || (mode === 'ios' && !showSteps)) && (
        <p className="m-0 text-body-sm text-koshur-muted">
          {today
            ? 'It opens like an app, and works without a connection.'
            : 'Add Shumār to your home screen. It opens in its own window and works without a connection.'}
        </p>
      )}
      {copyFailed && <p className="m-0 text-body-sm text-koshur-silk select-all">{siteAddress()}</p>}
      {(mode !== 'ios' || !showSteps || today) && (
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'prompt' && (
            <Button size="small" disabled={busy} onClick={() => void install()}>
              <Download aria-hidden="true" size={20} strokeWidth={2} className={ICON} />
              {today ? 'Install' : 'Install Shumār'}
            </Button>
          )}
          {mode === 'ios' && !showSteps && (
            <Button size="small" onClick={() => setShowSteps(true)}>
              <SquarePlus aria-hidden="true" size={20} strokeWidth={2} className={ICON} />
              Show me how
            </Button>
          )}
          {mode === 'elsewhere' && (
            <a href={chromeLink(siteAddress())} className={buttonClass('primary', 'small')}>
              <ExternalLink aria-hidden="true" size={20} strokeWidth={2} className={ICON} />
              Open in Chrome
            </a>
          )}
          {(mode === 'elsewhere' || mode === 'ios-other') && copyButton}
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
      <Toast message={notice} duration={4000} onDismiss={() => setNotice(null)} besideAddButton />
    </section>
  )
}
