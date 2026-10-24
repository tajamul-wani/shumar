import type { DailyTargets } from '../lib/targets.ts'

const MACROS = [
  { key: 'protein', label: 'Protein', bar: 'bg-macro-protein' },
  { key: 'carbs', label: 'Carbs', bar: 'bg-macro-carb' },
  { key: 'fat', label: 'Fat', bar: 'bg-macro-fat' },
] as const

/** A day's protein, carbs and fat targets, always in that order, each under its color. */
export function MacroTargets({ targets }: { targets: Pick<DailyTargets, 'protein' | 'carbs' | 'fat'> }) {
  return (
    <div className="grid grid-cols-3 gap-4 border-t border-koshur-border pt-4">
      {MACROS.map((macro) => (
        <p key={macro.key} className="m-0 flex flex-col gap-2">
          <span aria-hidden="true" className={`h-1 rounded-full ${macro.bar}`} />
          <span className="text-body-sm text-koshur-muted">{macro.label}</span>
          <span className="text-body font-semibold text-koshur-silk">{targets[macro.key]} g</span>
        </p>
      ))}
    </div>
  )
}
