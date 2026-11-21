import type { ButtonHTMLAttributes } from 'react'

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-pressed'> {
  pressed: boolean
  size?: 'normal' | 'small'
}

/** One choice in a group, such as a meal or a unit. The chosen one is filled with saffron. */
export function Chip({ pressed, size = 'normal', className = '', ...props }: ChipProps) {
  const sizing = size === 'small' ? 'min-h-9 px-3 text-body-sm' : 'min-h-11 px-4.5 text-body-sm'
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`${sizing} rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring focus-visible:ring-offset-2 focus-visible:ring-offset-koshur-base ${
        pressed
          ? 'border-deficit-ring bg-deficit-ring font-semibold text-koshur-surface dark:text-koshur-base'
          : 'border-koshur-border bg-transparent font-medium text-koshur-silk'
      } ${className}`}
      {...props}
    />
  )
}
