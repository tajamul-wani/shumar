import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary'
type Size = 'large' | 'small'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring focus-visible:ring-offset-2 focus-visible:ring-offset-koshur-base disabled:opacity-60'

const VARIANTS: Record<Variant, string> = {
  // Text on saffron is the base color in dark mode and the surface color in light mode, as designed.
  primary: 'bg-deficit-ring text-koshur-surface dark:text-koshur-base',
  secondary: 'border border-koshur-border bg-transparent text-koshur-silk',
}

const SIZES: Record<Size, string> = {
  large: 'min-h-13 px-4 text-body',
  small: 'min-h-11 px-3.5 text-body-sm',
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: Variant
  size?: Size
}

/** The one button used across the app. Every button is type="button": Shumār has no forms that submit on Enter yet. */
export function Button({ variant = 'primary', size = 'large', className = '', ...props }: ButtonProps) {
  return (
    <button type="button" className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...props} />
  )
}
