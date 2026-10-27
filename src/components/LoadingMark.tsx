import type { CSSProperties } from 'react'
import { usePrefersReducedMotion } from '../today/motion.ts'
import {
  MARK_DROPS,
  MARK_FILLED,
  MARK_HEXAGON,
  MARK_TRACK_LENGTH,
  MARK_TRACK_WIDTH,
  MARK_VIEWBOX,
} from './markShape.ts'

const DROP_COLORS = ['fill-macro-protein', 'fill-macro-carb', 'fill-macro-fat'] as const
/** The saffron stretch that runs round the hexagon: a quarter of the track. */
const RUNNING = MARK_TRACK_LENGTH / 4

/**
 * The Shumār mark while the app loads, as approved on 27 October 2026: a short saffron stretch
 * runs round the hexagon, sized to the screen. It fades in after 150 ms, so a quick load shows nothing, and on a device
 * set to reduce motion it is the logo, standing still. Screen readers hear the words beside it.
 */
export function LoadingMark() {
  const still = usePrefersReducedMotion()
  const dash = still
    ? `${MARK_FILLED * MARK_TRACK_LENGTH} ${MARK_TRACK_LENGTH}`
    : `${RUNNING} ${MARK_TRACK_LENGTH - RUNNING}`
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      aria-hidden="true"
      className="animate-mark-appear size-loading-mark"
      style={{ '--mark-track': MARK_TRACK_LENGTH } as CSSProperties}
    >
      <path
        d={MARK_HEXAGON}
        fill="none"
        strokeWidth={MARK_TRACK_WIDTH}
        strokeLinejoin="round"
        className="stroke-koshur-border"
      />
      <path
        d={MARK_HEXAGON}
        fill="none"
        strokeWidth={MARK_TRACK_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
        className={`stroke-deficit-ring ${still ? '' : 'animate-mark-run'}`}
      />
      {MARK_DROPS.map((d, i) => (
        <path key={d} d={d} className={DROP_COLORS[i]} />
      ))}
    </svg>
  )
}
