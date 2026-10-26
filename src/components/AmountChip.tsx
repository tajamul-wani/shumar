import type { ReactNode } from 'react'

/**
 * An amount such as "2 large" or "150 g" as a small saffron-bordered chip, so the quantity stands
 * out beside a food wherever it is listed (approved with the Today redesign, 26 October 2026).
 */
export function AmountChip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-md border border-deficit-ring px-1.5 text-caption font-semibold whitespace-nowrap text-deficit-ring ${className}`}
    >
      {children}
    </span>
  )
}
