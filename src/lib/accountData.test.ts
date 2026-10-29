import { describe, expect, it, vi } from 'vitest'
import { AccountError, buildExport, confirmsDeletion, deleteAccount, exportFileName } from './accountData.ts'
import type { LoggedFood } from './dayLogs.ts'
import type { MyFood } from './myFoods.ts'

const user = { email: 'a@example.com', user_metadata: { full_name: 'A Person' }, app_metadata: {} }
const answers = {
  ageYears: 30,
  sex: 'male',
  weightKg: 80,
  weightUnit: 'kg',
  heightCm: 175,
  activity: 'light',
  goal: { kind: 'lose', kgPerWeek: 0.5 },
} as const
const log: LoggedFood = {
  id: '1',
  logDate: '2026-10-24',
  loggedAt: '2026-10-24T08:00:00.000Z',
  meal: 'breakfast',
  foodName: 'Egg, whole, raw, fresh',
  foodSource: 'usda',
  foodSourceId: '171287',
  quantity: 2,
  unitName: 'large',
  grams: 100,
  nutrients: { kcal: 143, protein: 12.56, carbs: 0.72, fat: 9.51, sodiumMg: 142 },
}

describe('the data download', () => {
  it('holds the account, the answers, the target and every log, flat enough to read', () => {
    const file = buildExport(user, answers, [log], [], new Date('2026-10-24T10:00:00Z'))
    expect(file.app).toBe('Shumār')
    expect(file.exportedAt).toBe('2026-10-24T10:00:00.000Z')
    expect(file.account).toEqual({ email: 'a@example.com', name: 'A Person' })
    expect(file.answers).toEqual(answers)
    expect(file.target).toMatchObject({ kcal: 2176, protein: 128, carbs: 280, fat: 60 })
    expect(file.logs).toEqual([
      {
        date: '2026-10-24',
        loggedAt: '2026-10-24T08:00:00.000Z',
        meal: 'breakfast',
        food: 'Egg, whole, raw, fresh',
        source: 'usda',
        sourceId: '171287',
        quantity: 2,
        unit: 'large',
        grams: 100,
        kcal: 143,
        protein: 12.56,
        carbs: 0.72,
        fat: 9.51,
        sodiumMg: 142,
      },
    ])
  })

  it('has no target before the questions are answered', () => {
    const file = buildExport(
      { email: undefined, user_metadata: {}, app_metadata: {} },
      null,
      [],
      [],
      new Date(),
    )
    expect(file.account).toEqual({ email: null, name: null })
    expect(file.target).toBeNull()
    expect(file.logs).toEqual([])
    expect(file.myFoods).toEqual([])
  })

  it('holds the foods of their own, as the label gave them and per 100 g', () => {
    // A made-up food with easy numbers for checking the code, not nutrition data.
    const crackers: MyFood = {
      id: 'm1',
      name: 'Test crackers',
      brand: 'Test brand',
      basis: 'serving',
      servingGrams: 25,
      label: { kcal: 120, protein: 2, carbs: 16, fat: 5, sodiumMg: 200 },
    }
    const file = buildExport(user, answers, [], [crackers], new Date())
    expect(file.myFoods).toEqual([
      {
        name: 'Test crackers',
        brand: 'Test brand',
        labelGivesValuesPer: 'serving',
        servingGrams: 25,
        label: { kcal: 120, protein: 2, carbs: 16, fat: 5, sodiumMg: 200 },
        per100g: { kcal: 480, protein: 8, carbs: 64, fat: 20, sodiumMg: 800 },
      },
    ])
    expect(
      buildExport(user, answers, [], [{ ...crackers, basis: '100g', servingGrams: null }], new Date())
        .myFoods[0],
    ).toMatchObject({ labelGivesValuesPer: '100 g', per100g: crackers.label })
  })

  it('names the file for the day it was made', () => {
    expect(exportFileName(new Date(2026, 9, 24, 23, 30))).toBe('shumar-data-2026-10-24.json')
    expect(exportFileName(new Date(2026, 0, 5))).toBe('shumar-data-2026-01-05.json')
  })
})

describe('the typed confirmation', () => {
  it('accepts the word whatever the case or spacing, and nothing else', () => {
    expect(confirmsDeletion('delete')).toBe(true)
    expect(confirmsDeletion('  Delete ')).toBe(true)
    expect(confirmsDeletion('DELETE')).toBe(true)
    expect(confirmsDeletion('')).toBe(false)
    expect(confirmsDeletion('delet')).toBe(false)
    expect(confirmsDeletion('delete me')).toBe(false)
  })
})

describe('deleteAccount', () => {
  it('calls the database function once', async () => {
    const rpc = vi
      .fn<() => Promise<{ data: null; error: null }>>()
      .mockResolvedValue({ data: null, error: null })
    await deleteAccount({ rpc } as never)
    expect(rpc).toHaveBeenCalledWith('delete_my_account')
  })

  it('explains when it fails, without a technical message', async () => {
    const rpc = vi
      .fn<() => Promise<{ data: null; error: { message: string } }>>()
      .mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    await expect(deleteAccount({ rpc } as never)).rejects.toThrow(AccountError)
    await expect(deleteAccount({ rpc } as never)).rejects.toThrow(
      "We couldn't delete your account. Check your connection and try again.",
    )
  })
})
