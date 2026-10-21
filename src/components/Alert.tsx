import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

/** An error, read out as soon as it shows. The icon is hidden from screen readers so the text is read once. */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="m-0 flex items-start gap-2 text-body-sm text-koshur-silk">
      <CircleAlert aria-hidden="true" size={20} strokeWidth={2} className="shrink-0 text-alert-surplus" />
      {children}
    </p>
  )
}
