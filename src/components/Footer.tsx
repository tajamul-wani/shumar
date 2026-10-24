import { Link } from 'wouter'
import { DEVELOPER_GITHUB, DEVELOPER_LINKEDIN, SITE_NAME, SITE_OWNER } from '../shell/site.ts'
import { Logo } from './Logo.tsx'

const LINK =
  'inline-flex min-h-7 items-center text-body-sm text-koshur-silk transition-colors hover:text-deficit-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'
const HEADING = 'm-0 mb-1 text-caption font-semibold tracking-widest text-koshur-muted uppercase'

/** The bottom of every public page: what Shumār is, where to read more, and who made it. */
export function Footer() {
  return (
    <footer className="border-t border-koshur-border bg-koshur-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-10 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-x-16 gap-y-10">
          <div className="flex min-w-0 flex-1 basis-60 flex-col gap-3 sm:max-w-sm">
            <Logo decorative className="h-8 w-auto self-start" />
            <p className="m-0 text-body-sm text-koshur-muted">
              A calorie and macro tracker made for Kashmiri food. Free, with every value from a named source.
            </p>
          </div>
          {/* The two columns sit together at the right edge, level with "Built by" below them. */}
          <div className="flex flex-wrap gap-x-16 gap-y-10">
            <nav aria-label="About" className="flex min-w-40 flex-col gap-2">
              <h2 className={HEADING}>About</h2>
              <Link href="/privacy" className={LINK}>
                Privacy policy
              </Link>
              <Link href="/sources" className={LINK}>
                Where food values come from
              </Link>
            </nav>
            <nav aria-label="Support" className="flex flex-col gap-2">
              <h2 className={HEADING}>Support</h2>
              <a href={DEVELOPER_LINKEDIN} rel="noreferrer" className={LINK}>
                LinkedIn
              </a>
              <a href={DEVELOPER_GITHUB} rel="noreferrer" className={LINK}>
                GitHub
              </a>
            </nav>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-koshur-border pt-6 text-body-sm text-koshur-muted">
          <p className="m-0">© 2026 {SITE_NAME}. All rights reserved.</p>
          <p className="m-0">
            Built by{' '}
            <a
              href={DEVELOPER_LINKEDIN}
              rel="noreferrer"
              className="font-semibold text-koshur-silk transition-colors hover:text-deficit-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring"
            >
              {SITE_OWNER}
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
