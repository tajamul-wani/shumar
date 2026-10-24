import { Plus } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation, useRoute } from 'wouter'
import { Logo } from '../components/Logo.tsx'
import { ThemeButton } from '../components/ThemeButton.tsx'
import { EDIT_LOG_PATH, LOG_FOOD_PATH, NAV_ITEMS, type NavItem } from './nav.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

function SideLink({ item }: { item: NavItem }) {
  const [active] = useRoute(item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-body-sm ${FOCUS_RING} ${
        active
          ? 'bg-koshur-border font-semibold text-koshur-silk'
          : 'font-medium text-koshur-muted hover:text-koshur-silk'
      }`}
    >
      <Icon
        aria-hidden="true"
        size={20}
        strokeWidth={2}
        className={active ? 'text-deficit-ring' : undefined}
      />
      {item.label}
    </Link>
  )
}

function TabLink({ item }: { item: NavItem }) {
  const [active] = useRoute(item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl text-caption ${FOCUS_RING} ${
        active ? 'font-semibold text-deficit-ring' : 'font-medium text-koshur-muted'
      }`}
    >
      <Icon aria-hidden="true" size={24} strokeWidth={2} />
      {item.label}
    </Link>
  )
}

/** On desktop, one button steps through System, Light and Dark. */
/**
 * The frame every signed-in screen sits in: side navigation from 1024 px up, and a tab bar
 * with a floating add button below that.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation()
  const [onLogFood] = useRoute(LOG_FOOD_PATH)
  const [onEditLog] = useRoute(EDIT_LOG_PATH)
  // The questions that set the daily target end in their own button, so the add button steps aside.
  const [onQuestions] = useRoute('/start/*?')
  const previousLocation = useRef(location)

  // After moving to another screen, put keyboard and screen reader focus on its heading.
  useEffect(() => {
    if (previousLocation.current === location) return
    previousLocation.current = location
    document.querySelector<HTMLElement>('#main h1')?.focus()
  }, [location])

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-20 focus:rounded-xl focus:bg-koshur-surface focus:px-4 focus:py-3 focus:text-body focus:text-koshur-silk"
      >
        Skip to content
      </a>

      <aside className="hidden border-r border-koshur-border bg-koshur-surface px-3 py-6 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-50 lg:shrink-0 lg:flex-col lg:gap-7">
        <div className="px-3">
          <Logo className="h-9 w-auto" />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <SideLink key={item.href} item={item} />
          ))}
        </nav>
        <ThemeButton className="mt-auto" />
      </aside>

      <main id="main" className="min-w-0 flex-1 px-4 pt-6 pb-clear-add-button lg:px-8 lg:pt-7 lg:pb-12">
        <div className="mx-auto flex max-w-260 flex-col gap-6">{children}</div>
      </main>

      {!onLogFood && !onEditLog && !onQuestions && (
        <Link
          href={LOG_FOOD_PATH}
          aria-label="Log food"
          className={`fixed right-4 bottom-above-tab-bar z-10 flex size-15 items-center justify-center rounded-full bg-deficit-ring text-koshur-surface lg:hidden dark:text-koshur-base ${FOCUS_RING} focus-visible:ring-offset-2 focus-visible:ring-offset-koshur-base`}
        >
          <Plus aria-hidden="true" size={24} strokeWidth={2} />
        </Link>
      )}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-koshur-border bg-koshur-surface px-3 pt-2 pb-tab-bar lg:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <TabLink key={item.href} item={item} />
        ))}
      </nav>
    </div>
  )
}
