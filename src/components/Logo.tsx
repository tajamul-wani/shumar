import { useContext } from 'react'
import { ThemeContext } from '../theme/context.ts'
import { LOGO_SIZE } from './logoSizes.ts'

interface LogoProps {
  /** Sets the size, such as `h-8 w-auto`. */
  className?: string
  /** Hides it from screen readers when the name is already said nearby. */
  decorative?: boolean
}

/** The Shumār logo: the day hexagon with the name beside it, in the version drawn for the current theme. */
export function Logo({ className, decorative = false }: LogoProps) {
  const theme = useContext(ThemeContext)?.theme ?? 'dark'
  return (
    <img
      src={`/brand/logo-on-${theme}.svg`}
      alt={decorative ? '' : 'Shumār'}
      width={LOGO_SIZE[0]}
      height={LOGO_SIZE[1]}
      className={className}
    />
  )
}
