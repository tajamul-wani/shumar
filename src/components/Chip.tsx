import type { ButtonHTMLAttributes } from 'react'

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-pressed'> {
  pressed: boolean
}

/** One choice in a group, such as a meal or a unit. The chosen one is filled with saffron. */
export function Chip({ pressed, className = '', ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`min-h-11 rounded-full border px-4.5 text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring focus-visible:ring-offset-2 focus-visible:ring-offset-koshur-base ${
        pressed
          ? 'border-deficit-ring bg-deficit-ring font-semibold text-koshur-surface dark:text-koshur-base'
          : 'border-koshur-border bg-transparent font-medium text-koshur-silk'
      } ${className}`}
      {...props}
    />
  )
}
