import { useEffect, useState } from 'react'
import { useAuth } from '../auth/context.ts'
import { describeRelease } from '../lib/sources.ts'
import { useDocumentTitle } from '../shell/useDocumentTitle.ts'

const CARD = 'flex flex-col gap-2 rounded-2xl border border-koshur-border bg-koshur-surface p-5'

/**
 * Where every food value comes from. No approved design yet, so plain token styling.
 * The USDA releases are read from the database, so the list always matches the data in use.
 */
export function SourcesScreen() {
  useDocumentTitle('Food sources')
  const { client } = useAuth()
  const [releases, setReleases] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    client
      .from('usda_releases')
      .select('dataset, file_name')
      .order('dataset')
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data) setFailed(true)
        else setReleases(data.map((row) => describeRelease(row.dataset, row.file_name)))
      })
    return () => {
      active = false
    }
  }, [client])

  return (
    // A reading width: the page keeps the 1040 px column it was approved in, inside the wider shell.
    <div className="flex max-w-260 flex-col gap-6">
      <h1 tabIndex={-1} className="m-0 text-heading font-semibold focus:outline-none">
        Where food values come from
      </h1>
      <p className="m-0 text-body text-koshur-muted">
        Every value in Shumār comes from a named source, and every value is per 100 g of the food as eaten.
      </p>

      <section aria-labelledby="sources-kashmiri" className={CARD}>
        <h2 id="sources-kashmiri" className="m-0 text-body font-semibold">
          Kashmiri dishes
        </h2>
        <p className="m-0 text-body-sm text-koshur-muted">
          Shumār works these out from real recipes: every ingredient is weighed, the cooked dish is weighed,
          and the values are calculated per 100 g.
        </p>
      </section>

      <section aria-labelledby="sources-usda" className={CARD}>
        <h2 id="sources-usda" className="m-0 text-body font-semibold">
          Ingredients and everyday foods
        </h2>
        <p className="m-0 text-body-sm text-koshur-muted">
          From USDA FoodData Central, the food database of the United States Department of Agriculture. It is
          in the public domain.
        </p>
        {releases && (
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-koshur-silk">
            {releases.map((release) => (
              <li key={release}>{release}</li>
            ))}
          </ul>
        )}
        {failed && (
          <p className="m-0 text-body-sm text-koshur-muted">
            We couldn't load the list of USDA releases. Check your connection and try again.
          </p>
        )}
        <a
          href="https://fdc.nal.usda.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-sm text-body-sm text-koshur-silk underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring"
        >
          Visit USDA FoodData Central <span className="sr-only">(opens in a new tab)</span>
        </a>
      </section>

      <section aria-labelledby="sources-packaged" className={CARD}>
        <h2 id="sources-packaged" className="m-0 text-body font-semibold">
          Packaged foods
        </h2>
        <p className="m-0 text-body-sm text-koshur-muted">Copied from the nutrition label on the pack.</p>
      </section>
    </div>
  )
}
