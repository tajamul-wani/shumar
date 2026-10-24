export type ButtonVariant = 'primary' | 'secondary' | 'inset'
export type ButtonSize = 'large' | 'small'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring focus-visible:ring-offset-2 focus-visible:ring-offset-koshur-base disabled:opacity-60'

const VARIANTS: Record<ButtonVariant, string> = {
  // Text on saffron is the base color in dark mode and the surface color in light mode, as designed.
  primary: 'bg-deficit-ring text-koshur-surface hover:brightness-110 dark:text-koshur-base',
  secondary:
    'border border-koshur-border bg-transparent text-koshur-silk hover:border-deficit-ring hover:text-deficit-ring',
  // A secondary button set into a card, on the page color, as the You design's phone Adjust button.
  inset:
    'border border-koshur-border bg-koshur-base text-koshur-silk hover:border-deficit-ring hover:text-deficit-ring',
}

const SIZES: Record<ButtonSize, string> = {
  large: 'min-h-13 px-4 text-body',
  small: 'min-h-11 px-3.5 text-body-sm',
}

/** The one button look, for buttons and for links that act like buttons. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'large',
  extra = '',
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim()
}
