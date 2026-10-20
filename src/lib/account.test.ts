import { describe, expect, it } from 'vitest'
import { summarizeAccount, type AccountUser } from './account.ts'

function user(fields: Partial<AccountUser>): AccountUser {
  return { email: undefined, user_metadata: {}, app_metadata: {}, ...fields }
}

describe('summarizeAccount', () => {
  it('shows the Google name and says how the person signed in', () => {
    expect(
      summarizeAccount(
        user({
          email: 'a@example.com',
          user_metadata: { full_name: ' Tajamul Wani ' },
          app_metadata: { provider: 'google' },
        }),
      ),
    ).toEqual({ name: 'Tajamul Wani', detail: 'Signed in with Google', initial: 'T' })
  })

  it('falls back to the name field, then the email', () => {
    expect(summarizeAccount(user({ user_metadata: { name: 'Aisha' } })).name).toBe('Aisha')
    expect(summarizeAccount(user({ email: 'b@example.com', user_metadata: { full_name: '  ' } }))).toEqual({
      name: 'b@example.com',
      detail: null,
      initial: 'B',
    })
  })

  it('shows the email under a name when the account is not from Google', () => {
    expect(
      summarizeAccount(user({ email: 'c@example.com', user_metadata: { full_name: 'Sana' } })).detail,
    ).toBe('c@example.com')
  })

  it('still has something to show with no name or email', () => {
    expect(
      summarizeAccount(user({ user_metadata: undefined as unknown as AccountUser['user_metadata'] })),
    ).toEqual({
      name: 'Your account',
      detail: null,
      initial: 'Y',
    })
  })

  it('takes the first whole character of names in any script', () => {
    expect(summarizeAccount(user({ user_metadata: { full_name: 'شمار' } })).initial).toBe('ش')
  })
})
