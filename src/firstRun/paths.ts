import type { FirstRunStep } from '../lib/firstRun.ts'

export const FIRST_RUN_STEP_PATH = '/start/:step'

export const TARGET_PATH = '/start/target'

export function stepPath(step: FirstRunStep): string {
  return `/start/${step}`
}
