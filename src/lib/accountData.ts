import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountUser } from './account.ts'
import type { LoggedFood } from './dayLogs.ts'
import { toProfile, type FirstRunAnswers } from './firstRun.ts'
import { per100g, type MyFood } from './myFoods.ts'
import { dailyTargets } from './targets.ts'

/**
 * A person's data as one file, and the end of their account. Both are theirs to take: the
 * privacy policy promises them, and the You screen offers them.
 */

export class AccountError extends Error {}

/** Everything Shumār holds about a person, in plain JSON they can read or move elsewhere. */
export function buildExport(
  user: AccountUser,
  answers: FirstRunAnswers | null,
  logs: LoggedFood[],
  myFoods: MyFood[],
  now: Date,
) {
  const profile = answers && toProfile(answers)
  return {
    app: 'Shumār',
    exportedAt: now.toISOString(),
    account: { email: user.email ?? null, name: user.user_metadata?.full_name ?? null },
    answers,
    target: profile ? dailyTargets(profile) : null,
    logs: logs.map((log) => ({
      date: log.logDate,
      loggedAt: log.loggedAt,
      meal: log.meal,
      food: log.foodName,
      source: log.foodSource,
      sourceId: log.foodSourceId,
      quantity: log.quantity,
      unit: log.unitName,
      grams: log.grams,
      ...log.nutrients,
    })),
    myFoods: myFoods.map((food) => ({
      name: food.name,
      brand: food.brand,
      labelGivesValuesPer: food.basis === 'serving' ? 'serving' : '100 g',
      servingGrams: food.servingGrams,
      label: food.label,
      per100g: per100g(food),
    })),
  }
}

export type AccountExport = ReturnType<typeof buildExport>

/** shumar-data-2026-10-24.json, for the day it was made, in the person's own time zone. */
export function exportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `shumar-data-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

/** Hands the browser a file to save. */
export function saveFile(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

/** Deletes the signed-in person's account, answers and every log, in the database. */
/** The word a person types before the account can go. Case and spaces around it do not matter. */
export const DELETE_WORD = 'delete'

export function confirmsDeletion(typed: string): boolean {
  return typed.trim().toLowerCase() === DELETE_WORD
}

export async function deleteAccount(client: Pick<SupabaseClient, 'rpc'>): Promise<void> {
  const { error } = await client.rpc('delete_my_account')
  if (error) throw new AccountError("We couldn't delete your account. Check your connection and try again.")
}
