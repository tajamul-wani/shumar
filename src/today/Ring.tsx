import { formatNumber } from '../lib/foodDisplay.ts'
import type { RingState } from '../lib/today.ts'
import { SETTLE_MS, useCountUp, useSettled } from './motion.ts'

const RADIUS = 90
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function ringText(state: RingState): { number: number; caption: string } {
  if (state.kind === 'left') return { number: state.left, caption: 'kcal left' }
  if (state.kind === 'over') return { number: state.over, caption: 'kcal over' }
  return { number: state.eaten, caption: 'kcal eaten' }
}

interface RingProps {
  state: RingState
  /** Large on the Today hero, normal on a past day. */
  size?: 'normal' | 'large'
  /** Fill the ring and count the number up when the day loads and whenever it changes. */
  animate?: boolean
  /** Say what has been eaten of the target inside the ring, as the Today hero does. */
  detail?: boolean
}

/**
 * The calorie ring: saffron as the day fills toward the target, red once it passes it. With a
 * target it also says what has been eaten of it.
 */
export function Ring({ state, size = 'normal', animate = false, detail = false }: RingProps) {
  const { number, caption } = ringText(state)
  const progress = state.kind === 'eaten' ? 0 : state.progress
  const drawn = useSettled(progress, animate)
  const counted = useCountUp(number, animate)
  const sizing = size === 'large' ? 'size-52 lg:size-60' : 'size-50 lg:size-45'
  return (
    <div className={`relative shrink-0 ${sizing}`}>
      <svg viewBox="0 0 208 208" aria-hidden="true" className="size-full -rotate-90">
        <circle cx="104" cy="104" r={RADIUS} fill="none" strokeWidth="14" className="stroke-koshur-border" />
        {/* At zero a rounded arc would still paint a dot, so the arc only appears once there is something to show. */}
        {state.kind !== 'eaten' && drawn > 0 && (
          <circle
            cx="104"
            cy="104"
            r={RADIUS}
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${drawn * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            style={animate ? { transition: `stroke-dasharray ${SETTLE_MS}ms ease-out` } : undefined}
            className={state.kind === 'over' ? 'stroke-alert-surplus' : 'stroke-deficit-ring'}
          />
        )}
      </svg>
      <p className="absolute inset-0 m-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-display font-semibold text-koshur-silk">{formatNumber(counted)}</span>
        <span className="text-body-sm text-koshur-muted">{caption}</span>
        {detail && state.kind !== 'eaten' && (
          <span className="mt-1 text-caption text-koshur-muted">
            <span className="font-semibold text-koshur-silk">{formatNumber(state.eaten)}</span> eaten of{' '}
            {formatNumber(state.target)} kcal
          </span>
        )}
      </p>
    </div>
  )
}
