import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { USERS_FILE, createTestUser } from './support.ts'

/** Creates the two users the signed-in and data isolation tests share. */
export default async function globalSetup(): Promise<void> {
  const [a, b] = await Promise.all([createTestUser('a'), createTestUser('b')])
  mkdirSync(dirname(USERS_FILE), { recursive: true })
  writeFileSync(USERS_FILE, JSON.stringify({ a, b }), { mode: 0o600 })
}
