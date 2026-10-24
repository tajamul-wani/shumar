import { SITE_OWNER, SITE_REPO } from '../shell/site.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'

/** The date at the top. Change it with any change to the words below. */
export const PRIVACY_UPDATED = '24 October 2026'
/** How long a weekly backup is kept, as the security plan says. */
export const BACKUP_DAYS = 30

const H2 = 'm-0 text-heading font-semibold'
const P = 'm-0 text-body'
const LINK =
  'font-semibold text-deficit-ring hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'
const ISSUES = `${SITE_REPO}/issues`

const STORED = [
  [
    "Your Google account's name, email address and picture",
    'To sign you in and show who is signed in. Google hands these over when you sign in; Shumār never sees your password.',
  ],
  [
    'Your answers to the six questions: age, sex, weight, height, activity and goal',
    'To work out your daily calorie and macro target. Until you sign in, they stay on your device.',
  ],
  [
    'The food you log: the food, how much, which meal, when, and its calories and macros',
    "To show your day and your trends. This is the app's whole purpose.",
  ],
  [
    "Your theme choice, recent foods and the day's searches",
    'Kept on your device only, so the app is quick and works your way. Cleared when you sign out.',
  ],
] as const

/** The privacy policy, in plain words. Every line describes the app as it is built. */
export function PrivacyScreen() {
  useDocumentTitle('Privacy policy')
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none lg:text-display">
          Privacy policy
        </h1>
        <p className="m-0 text-body-sm text-koshur-muted">Last updated {PRIVACY_UPDATED}</p>
      </div>

      <section
        aria-labelledby="privacy-short"
        className="flex flex-col gap-3 rounded-2xl border border-koshur-border bg-koshur-surface p-5"
      >
        <h2 id="privacy-short" className="m-0 text-title font-semibold">
          In short
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-body">
          <li>Shumār stores your answers, your daily target and the food you log, and nothing else.</li>
          <li>Only you can see your logs. They are never sold, shared or used for ads.</li>
          <li>You sign in with Google. Shumār never sees your password.</li>
          <li>Your data is stored in India. There are no analytics and no tracking cookies.</li>
          <li>You can download everything, or delete your account and all of it, from the You screen.</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-who" className="flex flex-col gap-3">
        <h2 id="privacy-who" className={H2}>
          Who runs Shumār
        </h2>
        <p className={P}>
          Shumār is made and run by {SITE_OWNER}, an individual in Kashmir, India. For anything about your
          data,{' '}
          <a href={ISSUES} rel="noreferrer" className={LINK}>
            open an issue on GitHub
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="privacy-what" className="flex flex-col gap-3">
        <h2 id="privacy-what" className={H2}>
          What Shumār stores, and why
        </h2>
        <dl className="m-0 flex flex-col">
          {STORED.map(([what, why], i) => (
            <div
              key={what}
              className={`flex flex-col gap-1 py-3 ${i === 0 ? '' : 'border-t border-koshur-border'}`}
            >
              <dt className="text-body font-semibold">{what}</dt>
              <dd className="m-0 text-body-sm text-koshur-muted">{why}</dd>
            </div>
          ))}
        </dl>
        <p className={P}>
          Nothing else is collected. Shumār has no analytics, no advertising and no tracking cookies. The only
          thing the site keeps in your browser for itself is your sign-in session.
        </p>
      </section>

      <section aria-labelledby="privacy-where" className="flex flex-col gap-3">
        <h2 id="privacy-where" className={H2}>
          Where it is kept and who can see it
        </h2>
        <p className={P}>
          Your data is stored in a database run by Supabase in Mumbai, India. Every row is tied to your
          account, and the database itself refuses to show one person's rows to anyone else, so another user
          can never read your logs, even by accident.
        </p>
        <p className={P}>
          The site is served by Cloudflare, which, like any host, sees the internet address a request comes
          from in order to deliver the page. Shumār does not keep or use those addresses.
        </p>
        <p className={P}>
          {SITE_OWNER} can reach the database in order to run Shumār, and looks at an account's data only when
          you ask for help with it. Your data is never sold, shared or given to anyone else.
        </p>
      </section>

      <section aria-labelledby="privacy-keep" className="flex flex-col gap-3">
        <h2 id="privacy-keep" className={H2}>
          How long it is kept
        </h2>
        <p className={P}>
          Until you delete it. A weekly encrypted backup of the database is kept for up to {BACKUP_DAYS} days,
          so a deleted account can remain in a backup for that long and no longer.
        </p>
      </section>

      <section aria-labelledby="privacy-rights" className="flex flex-col gap-3">
        <h2 id="privacy-rights" className={H2}>
          Your data is yours
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-body">
          <li>
            <strong className="font-semibold">See and change it:</strong> your answers and target are on the
            You screen, and every log can be edited or removed.
          </li>
          <li>
            <strong className="font-semibold">Download it:</strong>{' '}
            <strong className="font-semibold">Download my data</strong> on the You screen gives you a file
            with your answers, your target and every log.
          </li>
          <li>
            <strong className="font-semibold">Delete it:</strong>{' '}
            <strong className="font-semibold">Delete my account</strong> on the You screen removes your
            account, your answers and every log straight away.
          </li>
        </ul>
        <p className={P}>If something does not work, say so and it will be done by hand.</p>
      </section>

      <section aria-labelledby="privacy-age" className="flex flex-col gap-3">
        <h2 id="privacy-age" className={H2}>
          Adults only, and not medical advice
        </h2>
        <p className={P}>
          Shumār is for people aged 18 and over. The formulas behind the targets were made for adults, so the
          app does not accept a younger age, and no account is knowingly kept for a child.
        </p>
        <p className={P}>
          The targets are general guidance worked out from published formulas. They are not medical advice. If
          you are pregnant, have a health condition or are under a doctor's care, follow their advice first.
        </p>
      </section>

      <section aria-labelledby="privacy-changes" className="flex flex-col gap-3">
        <h2 id="privacy-changes" className={H2}>
          Changes to this policy
        </h2>
        <p className={P}>
          If this policy changes, the date at the top changes with it. A change that means Shumār keeps more
          than it does today is shown in the app before it applies.
        </p>
      </section>
    </>
  )
}
