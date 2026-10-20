import { ChartColumn, Circle, User, type LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

/** The three main screens, in the order the tab bar and the side navigation show them. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Today', icon: Circle },
  { href: '/trends', label: 'Trends', icon: ChartColumn },
  { href: '/you', label: 'You', icon: User },
]

export const LOG_FOOD_PATH = '/log'
