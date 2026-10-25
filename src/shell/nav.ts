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

/** One day, opened from the Trends chart. */
export const TRENDS_DAY_PATH = '/trends/day/:date'

export function trendsDayPath(date: string): string {
  return `/trends/day/${date}`
}

/** Changing a food already logged. */
export const EDIT_LOG_PATH = '/log/edit/:id'

export function editLogPath(id: string): string {
  return `/log/edit/${encodeURIComponent(id)}`
}
