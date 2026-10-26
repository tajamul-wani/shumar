import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '../shell/useMediaQuery.ts'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** True when the person has asked their device for less motion: numbers and rings then move at once. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION)
}

/** How long the ring and its number take to settle, in milliseconds. Short and once, as the design rules ask. */
export const SETTLE_MS = 600

/**
 * A number that counts from where it was to `target` over SETTLE_MS, easing out. Off, it is simply
 * the target. The first value shown is 0, so a day counts up as it loads.
 */
export function useCountUp(target: number, enabled: boolean): number {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (!enabled) return
    const start = performance.now()
    const begin = from.current
    // The frame's own timestamp can run on another clock than performance.now(), so one clock is used throughout.
    let frame = requestAnimationFrame(function tick() {
      const t = Math.min(1, (performance.now() - start) / SETTLE_MS)
      const eased = 1 - (1 - t) ** 3
      const next = Math.round(begin + (target - begin) * eased)
      from.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, enabled])
  return enabled ? shown : target
}

/**
 * A value that starts at 0 on the first paint and moves to `target` a frame later, so a CSS
 * transition on it plays once when the screen loads and again whenever it changes. Off, it is the target.
 */
export function useSettled(target: number, enabled: boolean): number {
  const [settled, setSettled] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const frame = requestAnimationFrame(() => setSettled(target))
    return () => cancelAnimationFrame(frame)
  }, [target, enabled])
  return enabled ? settled : target
}
