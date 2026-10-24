import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/context.ts'
import { clearAnswers, readAnswers, toProfile, type FirstRunAnswers } from '../lib/firstRun.ts'
import { ProfileError, fetchProfile, saveProfile } from '../lib/profile.ts'
import { ProfileContext, type ProfileState } from './context.ts'

type Loaded = Pick<ProfileState, 'answers' | 'status' | 'error'>

/**
 * Loads the signed-in person's first-run answers and shares them with every screen. Answers
 * given on this device before signing in are the newest, so they replace any saved ones, and
 * are cleared from the device once saved.
 */
export function ProfileProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const { client } = useAuth()
  const [loaded, setLoaded] = useState<Loaded>({ answers: null, status: 'loading', error: null })
  const [editing, setEditing] = useState<FirstRunAnswers | null>(null)
  // Only the newest request may update the screen, so a slow older answer never wins.
  const latest = useRef(0)

  const load = useCallback(() => {
    const request = ++latest.current
    async function answers(): Promise<FirstRunAnswers | null> {
      const onDevice = readAnswers()
      if (toProfile(onDevice)) {
        await saveProfile(client, userId, onDevice)
        clearAnswers()
        return onDevice
      }
      return fetchProfile(client)
    }
    answers().then(
      (next) => {
        if (request === latest.current) setLoaded({ answers: next, status: 'ready', error: null })
      },
      (failure: unknown) => {
        if (request !== latest.current) return
        setLoaded({
          answers: null,
          status: 'error',
          error:
            failure instanceof ProfileError
              ? failure.message
              : "We couldn't load your target. Check your connection and try again.",
        })
      },
    )
  }, [client, userId])

  useEffect(() => {
    load()
    return () => {
      latest.current += 1
    }
  }, [load])

  const save = useCallback(
    async (answers: FirstRunAnswers) => {
      await saveProfile(client, userId, answers)
      // Anything still loading is older than what was just saved.
      latest.current += 1
      setLoaded({ answers, status: 'ready', error: null })
    },
    [client, userId],
  )

  const value = useMemo<ProfileState>(
    () => ({
      ...loaded,
      reload: () => {
        setLoaded((current) => ({ ...current, status: 'loading', error: null }))
        load()
      },
      editing,
      edit: setEditing,
      save,
    }),
    [loaded, load, editing, save],
  )
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
