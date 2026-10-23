import { ChevronLeft } from 'lucide-react'
import { Link } from 'wouter'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

/** Back to the screen before: the arrow alone on phones and tablets, the arrow and "Back" on wide screens. */
export function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={`-ml-2.5 flex min-h-11 min-w-11 items-center justify-center gap-1 self-start rounded-xl text-koshur-silk lg:-ml-1.5 lg:pr-2 ${FOCUS_RING}`}
    >
      <ChevronLeft aria-hidden="true" size={24} strokeWidth={2} className="size-5 sm:size-6" />
      <span className="sr-only text-body-sm font-semibold lg:not-sr-only">Back</span>
    </Link>
  )
}
