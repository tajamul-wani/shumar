import { Package, Plus } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Button } from '../components/Button.tsx'
import { useSheetFill } from './fill.ts'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'

/** A quiet way to add a food from its pack, under a list of foods. */
export function FromPackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 self-start rounded-xl text-body-sm font-medium text-koshur-muted ${FOCUS_RING}`}
    >
      <Plus
        aria-hidden="true"
        size={20}
        strokeWidth={2}
        className="size-4 shrink-0 text-deficit-ring sm:size-5"
      />
      {children}
    </button>
  )
}

/** When a search finds nothing: the food can be added from the values on its pack. */
export function FromPackCard({ query, onAdd }: { query: string; onAdd: () => void }) {
  const fill = useSheetFill()
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className={`flex flex-col gap-3 rounded-2xl border border-koshur-border ${fill} p-4`}
    >
      <div className="flex items-center gap-2.5">
        <Package
          aria-hidden="true"
          size={20}
          strokeWidth={2}
          className="size-4 shrink-0 text-deficit-ring sm:size-5"
        />
        <h3 id={headingId} className="m-0 text-body font-semibold">
          Have the pack?
        </h3>
      </div>
      <p className="m-0 text-body-sm text-koshur-muted">
        Add {query} with the values printed on its label. Only you will see it.
      </p>
      <Button variant="secondary" size="small" onClick={onAdd} className="self-start">
        <Plus aria-hidden="true" size={20} strokeWidth={2} className="size-4 text-deficit-ring" />
        Add it from the pack
      </Button>
    </section>
  )
}
