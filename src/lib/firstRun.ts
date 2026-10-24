/**
 * The first-run answers, kept on this device until the person signs in. They are stored under
 * the user cache prefix, so signing out wipes them, and checked again whenever they are read.
 */

import { USER_CACHE_PREFIX } from './auth.ts'
import { deviceStorage } from './deviceStorage.ts'
import {
  ACTIVITY_PAL,
  LOSS_DEFICIT_KCAL,
  MIN_KCAL,
  PROFILE_LIMITS,
  type ActivityLevel,
  type Goal,
  type LossRate,
  type Profile,
  type Sex,
} from './targets.ts'

export const FIRST_RUN_KEY = `${USER_CACHE_PREFIX}first-run`

export type WeightUnit = 'kg' | 'lb'

/** 1 lb = 0.45359237 kg exactly: the international pound. Weights are stored in kg. */
export const KG_PER_LB = 0.45359237

/** The kg limits in pounds, rounded inwards so every accepted pound weight is inside them. */
export const WEIGHT_LIMITS_LB = {
  min: Math.ceil(PROFILE_LIMITS.weightKg.min / KG_PER_LB),
  max: Math.floor(PROFILE_LIMITS.weightKg.max / KG_PER_LB),
} as const

/** The answers so far. Each is missing until its question is answered. */
export interface FirstRunAnswers {
  ageYears?: number
  sex?: Sex
  weightKg?: number
  weightUnit: WeightUnit
  heightCm?: number
  activity?: ActivityLevel
  goal?: Goal
}

export const NO_ANSWERS: FirstRunAnswers = { weightUnit: 'kg' }

/** The questions in the order they are asked. */
export const FIRST_RUN_STEPS = ['age', 'sex', 'weight', 'height', 'activity', 'goal'] as const
export type FirstRunStep = (typeof FIRST_RUN_STEPS)[number]

const ANSWER_FOR_STEP: Record<FirstRunStep, keyof FirstRunAnswers> = {
  age: 'ageYears',
  sex: 'sex',
  weight: 'weightKg',
  height: 'heightCm',
  activity: 'activity',
  goal: 'goal',
}

export const SEX_CHOICES: readonly { id: Sex; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
]

export const ACTIVITY_CHOICES: readonly { id: ActivityLevel; label: string; detail: string }[] = [
  {
    id: 'sedentary',
    label: 'Sedentary',
    detail: 'Sitting most of the day, little walking and no regular exercise.',
  },
  {
    id: 'light',
    label: 'Lightly active',
    detail: 'On your feet for part of the day, walking or doing housework, with little planned exercise.',
  },
  {
    id: 'moderate',
    label: 'Moderately active',
    detail: 'About an hour of brisk exercise most days, or a job that keeps you moving.',
  },
  {
    id: 'very',
    label: 'Very active',
    detail: 'Hard physical work or hard training for several hours on most days.',
  },
]

export type GoalKind = Goal['kind']

export const GOAL_CHOICES: readonly { id: GoalKind; label: string; detail: string }[] = [
  { id: 'lose', label: 'Lose weight', detail: 'Eat a little less than you burn.' },
  { id: 'maintain', label: 'Keep my weight', detail: 'Eat about what you burn.' },
  { id: 'gain', label: 'Gain weight', detail: 'Eat a little more than you burn.' },
  {
    id: 'recomp',
    label: 'Body recomposition',
    detail: 'Lose fat and build muscle at about the same weight. Needs regular strength training.',
  },
]

/** The weight-loss speeds in kg a week, slowest first. */
export const LOSS_RATES = Object.keys(LOSS_DEFICIT_KCAL)
  .map(Number)
  .sort((a, b) => a - b) as LossRate[]

/** The speed chosen when someone first picks "Lose weight". */
export const DEFAULT_LOSS_RATE: LossRate = 0.5

/** One decimal at most, without a trailing ".0". */
function oneDecimal(value: number): string {
  return String(Math.round(value * 10) / 10)
}

function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}

function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

/** A weight in kg as the person reads it in their unit, for example "176.4". */
export function weightInUnit(kg: number, unit: WeightUnit): string {
  return oneDecimal(unit === 'kg' ? kg : kgToLb(kg))
}

/** "0.5 kg a week", or the same speed in pounds: "1.1 lb a week". */
export function speedLabel(kgPerWeek: LossRate, unit: WeightUnit): string {
  const amount = unit === 'kg' ? String(kgPerWeek) : weightInUnit(kgPerWeek, unit)
  return `${amount} ${unit} a week`
}

export function goalSummary(goal: Goal, unit: WeightUnit): string {
  if (goal.kind === 'lose') return `Lose ${speedLabel(goal.kgPerWeek, unit)}`
  return GOAL_CHOICES.find((choice) => choice.id === goal.kind)?.label ?? ''
}

type Checked = { ok: true; value: number } | { ok: false; message: string }

const WHOLE = /^\d+$/
const DECIMAL = /^\d+(\.\d+)?$/

function checkNumber(text: string, pattern: RegExp, min: number, max: number, message: string): Checked {
  const trimmed = text.trim()
  if (!pattern.test(trimmed)) return { ok: false, message }
  const value = Number(trimmed)
  return value >= min && value <= max ? { ok: true, value } : { ok: false, message }
}

/** Age as typed: a whole number of years inside the accepted range. */
export function checkAge(text: string): Checked {
  const { min, max } = PROFILE_LIMITS.ageYears
  return checkNumber(text, WHOLE, min, max, `Enter your age in whole years, from ${min} to ${max}.`)
}

/** Weight as typed in either unit, returned in kg. */
export function checkWeight(text: string, unit: WeightUnit): Checked {
  const { min, max } = unit === 'kg' ? PROFILE_LIMITS.weightKg : WEIGHT_LIMITS_LB
  const checked = checkNumber(text, DECIMAL, min, max, `Enter a weight from ${min} to ${max} ${unit}.`)
  if (!checked.ok || unit === 'kg') return checked
  return { ok: true, value: lbToKg(checked.value) }
}

/** Height as typed, in cm. */
export function checkHeight(text: string): Checked {
  const { min, max } = PROFILE_LIMITS.heightCm
  return checkNumber(text, DECIMAL, min, max, `Enter a height from ${min} to ${max} cm.`)
}

export function weightHint(unit: WeightUnit): string {
  const { min, max } = unit === 'kg' ? PROFILE_LIMITS.weightKg : WEIGHT_LIMITS_LB
  return `From ${min} to ${max} ${unit}.`
}

function inRange(value: unknown, { min, max }: { min: number; max: number }): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function isOneOf<T extends string>(value: unknown, options: object): value is T {
  return typeof value === 'string' && Object.hasOwn(options, value)
}

function parseGoal(value: unknown): Goal | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { kind, kgPerWeek } = value as { kind?: unknown; kgPerWeek?: unknown }
  if (kind === 'lose') {
    return typeof kgPerWeek === 'number' && Object.hasOwn(LOSS_DEFICIT_KCAL, kgPerWeek)
      ? { kind, kgPerWeek: kgPerWeek as LossRate }
      : undefined
  }
  return kind === 'maintain' || kind === 'gain' || kind === 'recomp' ? { kind } : undefined
}

/** Device storage can be edited or corrupted, so each answer is checked again and dropped if wrong. */
export function parseAnswers(raw: unknown): FirstRunAnswers {
  if (typeof raw !== 'object' || raw === null) return { ...NO_ANSWERS }
  const r = raw as Record<string, unknown>
  const answers: FirstRunAnswers = { weightUnit: r.weightUnit === 'lb' ? 'lb' : 'kg' }
  if (inRange(r.ageYears, PROFILE_LIMITS.ageYears) && Number.isInteger(r.ageYears)) {
    answers.ageYears = r.ageYears
  }
  if (isOneOf<Sex>(r.sex, MIN_KCAL)) answers.sex = r.sex
  if (inRange(r.weightKg, PROFILE_LIMITS.weightKg)) answers.weightKg = r.weightKg
  if (inRange(r.heightCm, PROFILE_LIMITS.heightCm)) answers.heightCm = r.heightCm
  if (isOneOf<ActivityLevel>(r.activity, ACTIVITY_PAL)) answers.activity = r.activity
  const goal = parseGoal(r.goal)
  if (goal) answers.goal = goal
  return answers
}

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>
type RemoveStorage = Pick<Storage, 'removeItem'>

export function readAnswers(storage: ReadStorage | undefined = deviceStorage()): FirstRunAnswers {
  try {
    return parseAnswers(JSON.parse(storage?.getItem(FIRST_RUN_KEY) ?? 'null'))
  } catch {
    return { ...NO_ANSWERS }
  }
}

export function saveAnswers(
  answers: FirstRunAnswers,
  storage: WriteStorage | undefined = deviceStorage(),
): void {
  try {
    storage?.setItem(FIRST_RUN_KEY, JSON.stringify(answers))
  } catch {
    // Storage is full or blocked: the answers last only until the page closes.
  }
}

/** Clears the answers from the device, once they are saved to the person's profile. */
export function clearAnswers(storage: RemoveStorage | undefined = deviceStorage()): void {
  try {
    storage?.removeItem(FIRST_RUN_KEY)
  } catch {
    // Blocked storage holds nothing to clear.
  }
}

function isAnswered(answers: FirstRunAnswers, step: FirstRunStep): boolean {
  return answers[ANSWER_FOR_STEP[step]] !== undefined
}

/** The first question still to answer, or null once every one is answered. */
export function firstUnanswered(answers: FirstRunAnswers): FirstRunStep | null {
  return FIRST_RUN_STEPS.find((step) => !isAnswered(answers, step)) ?? null
}

/** The answers as a profile for the targets, once every question is answered. */
export function toProfile(answers: FirstRunAnswers): Profile | null {
  const { ageYears, sex, weightKg, heightCm, activity, goal } = answers
  if (
    ageYears === undefined ||
    sex === undefined ||
    weightKg === undefined ||
    heightCm === undefined ||
    activity === undefined ||
    goal === undefined
  ) {
    return null
  }
  return { ageYears, sex, weightKg, heightCm, activity, goal }
}
