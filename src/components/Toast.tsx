import { Check, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type Ref } from 'react'

export interface ToastMessage {
  /** A new id for each message, so the same words shown again still start a fresh timer. */
  id: number
  /** Short enough to fit one line on any phone, such as "Added to lunch". */
  text: string
  /** Read out after the text but not shown, such as the food's full name. */
  detail?: string
  /**
   * Added (or put back) gets a saffron edge and check; removed gets a gray edge and bin; a new
   * version of the app gets a saffron edge and the refresh arrows.
   */
  tone: 'added' | 'removed' | 'update'
}

interface ToastAction {
  label: string
  onClick: () => void
  /** While the action works, it can't be pressed again. */
  busy?: boolean
}

interface ToastProps {
  message: ToastMessage | null
  /** How long it stays while nobody is using it, in milliseconds. */
  duration: number
  onDismiss: () => void
  /** A button such as Undo. */
  action?: ToastAction | null
  /** Lets the screen move focus to the action, as after removing a food. */
  actionRef?: Ref<HTMLButtonElement>
  /** On phones, sit beside the round add button instead of using the full width. */
  besideAddButton?: boolean
  /**
   * On phones, take the full width just above the round add button, so a rare notice whose words
   * need the whole line never covers the button.
   */
  aboveAddButton?: boolean
}

const TONES = {
  added: { edge: 'border-l-deficit-ring', icon: Check, iconColor: 'text-deficit-ring' },
  removed: { edge: 'border-l-koshur-muted', icon: Trash2, iconColor: 'text-koshur-muted' },
  update: { edge: 'border-l-deficit-ring', icon: RefreshCw, iconColor: 'text-deficit-ring' },
} as const

/**
 * A short one-line message: at the bottom right on wide screens, and on phones in the bottom strip
 * the add button already uses, so it covers nothing new (a rare notice that needs the whole line
 * sits just above the button). Its own fill (the border color) sets it apart from both the page
 * and the cards; its colored edge and icon say what happened, while red stays for alerts and errors.
 * It closes by itself, but waits while it is touched, hovered or focused. The live region is always
 * there, so each message is read out, with its detail.
 */
export function Toast({
  message,
  duration,
  onDismiss,
  action,
  actionRef,
  besideAddButton = false,
  aboveAddButton = false,
}: ToastProps) {
  // The message being used right now. A new message starts unpaused, even if the button that held
  // focus disappeared without a blur event.
  const [pausedFor, setPausedFor] = useState<number | null>(null)
  const paused = message !== null && pausedFor === message.id
  const regionRef = useRef<HTMLOutputElement>(null)
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  })

  useEffect(() => {
    if (!message || paused) return
    const timer = setTimeout(() => dismiss.current(), duration)
    return () => clearTimeout(timer)
  }, [message, paused, duration])

  // Touching, hovering or focusing the toast (or its button) holds it open.
  useEffect(() => {
    const region = regionRef.current
    if (!region || !message) return
    const pause = () => setPausedFor(message.id)
    const resume = () => setPausedFor(null)
    const events = [
      ['pointerenter', pause],
      ['pointerleave', resume],
      ['focusin', pause],
      ['focusout', resume],
    ] as const
    for (const [name, handler] of events) region.addEventListener(name, handler)
    return () => {
      for (const [name, handler] of events) region.removeEventListener(name, handler)
    }
  }, [message])

  const tone = message ? TONES[message.tone] : null
  const Icon = tone?.icon
  const onPhones = besideAddButton
    ? 'bottom-above-tab-bar right-24'
    : aboveAddButton
      ? 'bottom-above-add-button right-4'
      : 'bottom-above-tab-bar right-4'

  return (
    <div
      className={`pointer-events-none fixed left-4 z-20 flex justify-end lg:right-6 lg:bottom-6 lg:left-auto lg:w-96 ${onPhones}`}
    >
      <output
        ref={regionRef}
        className={
          tone
            ? // Thin and wide: 48 px tall, centered beside the 60 px add button on phones, 384 px wide on wide screens.
              `pointer-events-auto flex min-h-12 w-full items-center gap-2.5 rounded-xl border-l-4 bg-koshur-border py-0.5 pr-1 pl-3 text-body-sm text-koshur-silk ${aboveAddButton ? '' : 'mb-1.5 lg:mb-0'} ${tone.edge}`
            : 'sr-only'
        }
      >
        {message && tone && Icon && (
          <>
            <Icon
              aria-hidden="true"
              size={20}
              strokeWidth={2}
              className={`size-4 shrink-0 ${tone.iconColor}`}
            />
            <span className="min-w-0 flex-1">
              {message.text}
              {message.detail && <span className="sr-only"> · {message.detail}</span>}
            </span>
            {action && (
              <button
                ref={actionRef}
                type="button"
                onClick={action.onClick}
                aria-disabled={action.busy}
                className="min-h-11 shrink-0 rounded-lg px-3 font-semibold text-koshur-silk underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-deficit-ring focus-visible:outline-none aria-disabled:opacity-60"
              >
                {action.label}
              </button>
            )}
          </>
        )}
      </output>
    </div>
  )
}
