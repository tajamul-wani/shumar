import { Monitor, Moon, Sun } from 'lucide-react'
import { PREFERENCE_LABELS, nextPreference, type ThemePreference } from '../lib/theme.ts'
import { useTheme } from '../theme/context.ts'

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const satisfies Record<ThemePreference, unknown>

const BUTTON =
  'flex items-center rounded-xl text-koshur-silk transition-colors hover:text-deficit-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deficit-ring'
// The sidebar's version is a bordered row; the header's is small and quiet, as Supabase's header has.
const ROW =
  'min-h-11 gap-2.5 border border-koshur-border px-3 text-left text-body-sm hover:border-deficit-ring'
const COMPACT = 'size-9 justify-center text-koshur-muted hover:bg-koshur-surface'

/** Cycles the theme through system, light and dark, with an icon for each: a screen, the sun, the moon. Compact: the icon alone. */
export function ThemeButton({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { preference, setPreference } = useTheme()
  const next = nextPreference(preference)
  const Icon = ICONS[preference]
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Theme: ${PREFERENCE_LABELS[preference]}. Switch to ${PREFERENCE_LABELS[next]}`}
      className={`${BUTTON} ${compact ? COMPACT : ROW} ${className}`}
    >
      <Icon aria-hidden="true" size={compact ? 16 : 20} strokeWidth={2} />
      {!compact && `Theme: ${PREFERENCE_LABELS[preference]}`}
    </button>
  )
}
