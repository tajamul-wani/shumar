import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonStyles.ts'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

/** The one button used across the app. Every button is type="button": Shumār has no forms that submit on Enter yet. */
export function Button({ variant = 'primary', size = 'large', className = '', ...props }: ButtonProps) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />
}
