import { expect, test } from '@playwright/test'
import { apiClient, readTestUsers } from './support.ts'

// Calls the real API the way anyone holding the public key could, without the app.
// Row-level security is the only thing protecting each user's logs here.

// A placeholder row: these values only exercise the API and are not nutrition data.
const row = {
  meal: 'lunch',
  food_name: 'Test item',
  food_source: 'kashmiri',
  quantity: 1,
  unit_name: 'piece',
  grams: 1,
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
}

test('a user can only ever reach their own logs', async () => {
  const { a, b } = readTestUsers()
  const asA = apiClient(a.session.access_token)
  const asB = apiClient(b.session.access_token)

  const created = await asA.from('user_logs').insert(row).select('id, user_id').single()
  expect(created.error).toBeNull()
  expect(created.data?.user_id).toBe(a.session.user.id)
  const id = created.data?.id as string

  try {
    const seen = await asB.from('user_logs').select('id').eq('id', id)
    expect(seen.data).toEqual([])

    const changed = await asB.from('user_logs').update({ food_name: 'Changed' }).eq('id', id).select('id')
    expect(changed.data).toEqual([])

    const removed = await asB.from('user_logs').delete().eq('id', id).select('id')
    expect(removed.data).toEqual([])

    const forged = await asB.from('user_logs').insert({ ...row, user_id: a.session.user.id })
    expect(forged.error?.code).toBe('42501')

    const own = await asA.from('user_logs').select('food_name').eq('id', id).single()
    expect(own.data?.food_name).toBe('Test item')
  } finally {
    await asA.from('user_logs').delete().eq('id', id)
  }
})

test('a visitor who is not signed in can read the food catalog but no logs', async () => {
  const visitor = apiClient()
  const catalog = await visitor.from('kashmiri_foods').select('id').limit(1)
  expect(catalog.error).toBeNull()

  const logs = await visitor.from('user_logs').select('id')
  expect(logs.error?.code).toBe('42501')
})
