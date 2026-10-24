import type { SupabaseClient } from '@supabase/supabase-js'
import { parseAnswers, toProfile, type FirstRunAnswers } from './firstRun.ts'

/**
 * Each person's first-run answers, in their own row of the profiles table. Row-level security
 * limits every query to the signed-in person's row, and the row is checked with the same rules
 * as the answers on the device before the app uses it. Targets are worked out from the answers
 * on the device, so only the answers are stored.
 */

type ProfileClient = Pick<SupabaseClient, 'from'>

const PROFILE_COLUMNS =
  'age_years, answered_at, sex, weight_kg, weight_unit, height_cm, activity, goal, loss_kg_per_week'

export class ProfileError extends Error {}

const YEAR_MS = 365.2425 * 24 * 60 * 60 * 1000

/** The age now: the age given, plus the whole years since it was given. */
export function currentAge(ageGiven: number, answeredAt: Date, now: Date): number {
  return ageGiven + Math.max(0, Math.floor((now.getTime() - answeredAt.getTime()) / YEAR_MS))
}

/** Postgres numbers can arrive as text. */
function numeric(value: unknown): unknown {
  return typeof value === 'string' && value.trim() !== '' ? Number(value) : value
}

/** Checks a profiles row. Returns the answers, or null if any is missing or out of range. */
export function parseProfileRow(value: unknown, now: Date): FirstRunAnswers | null {
  const row = (value ?? {}) as Record<string, unknown>
  const answeredAt = typeof row.answered_at === 'string' ? new Date(row.answered_at) : null
  const ageGiven = numeric(row.age_years)
  const answers = parseAnswers({
    ageYears:
      typeof ageGiven === 'number' && answeredAt && !Number.isNaN(answeredAt.getTime())
        ? currentAge(ageGiven, answeredAt, now)
        : undefined,
    sex: row.sex,
    weightKg: numeric(row.weight_kg),
    weightUnit: row.weight_unit,
    heightCm: numeric(row.height_cm),
    activity: row.activity,
    goal: { kind: row.goal, kgPerWeek: numeric(row.loss_kg_per_week) },
  })
  return toProfile(answers) ? answers : null
}

/** The signed-in person's answers, or null when they haven't answered yet. */
export async function fetchProfile(client: ProfileClient, now = new Date()): Promise<FirstRunAnswers | null> {
  const { data, error } = await client.from('profiles').select(PROFILE_COLUMNS).maybeSingle()
  if (error) throw new ProfileError("We couldn't load your target. Check your connection and try again.")
  return data ? parseProfileRow(data, now) : null
}

/** Saves a full set of answers, replacing any saved before. */
export async function saveProfile(
  client: ProfileClient,
  userId: string,
  answers: FirstRunAnswers,
  now = new Date(),
): Promise<void> {
  const profile = toProfile(answers)
  if (!profile) throw new ProfileError('Answer every question to set your target.')
  const { error } = await client.from('profiles').upsert(
    {
      user_id: userId,
      age_years: profile.ageYears,
      answered_at: now.toISOString(),
      sex: profile.sex,
      // The table keeps 3 decimal places of kg and 1 of cm.
      weight_kg: Math.round(profile.weightKg * 1000) / 1000,
      weight_unit: answers.weightUnit,
      height_cm: Math.round(profile.heightCm * 10) / 10,
      activity: profile.activity,
      goal: profile.goal.kind,
      loss_kg_per_week: profile.goal.kind === 'lose' ? profile.goal.kgPerWeek : null,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new ProfileError("We couldn't save your answers. Check your connection and try again.")
}
