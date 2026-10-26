import { Plus } from 'lucide-react'
import { Link } from 'wouter'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

const ROUND = `fixed right-4 bottom-above-tab-bar z-10 flex size-15 items-center justify-center rounded-full bg-deficit-ring text-koshur-surface lg:hidden dark:text-koshur-base ${FOCUS_RING} focus-visible:ring-offset-2 focus-visible:ring-offset-koshur-base`

type AddButtonProps = { label: string } & (
  { href: string; onClick?: never } | { onClick: () => void; href?: never }
)

/** The round saffron plus above the tab bar on phones and tablets: a link to a screen, or a button that opens the Add food sheet. */
export function AddButton({ label, href, onClick }: AddButtonProps) {
  const icon = <Plus aria-hidden="true" size={24} strokeWidth={2} />
  if (href) {
    return (
      <Link href={href} aria-label={label} className={ROUND}>
        {icon}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={ROUND}>
      {icon}
    </button>
  )
}
