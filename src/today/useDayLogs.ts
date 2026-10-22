import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/context.ts'
import { fetchDayLogs, fetchDaysLogged, type LoggedFood } from '../lib/dayLogs.ts'
import { LogError } from '../lib/logs.ts'

export interface DayLogs {
  /** null until the day has loaded. */
  logs: LoggedFood[] | null
  /** Why the day couldn't load, if it couldn't. */
  error: string | null
  /** null while unknown or when it can't be read. */
  daysLogged: number | null
  /** Reads the day again, for example after a food is added beside it. */
  reload: () => void
  /** Changes the day's list on the screen at once, such as when a food is removed. */
  update: (change: (logs: LoggedFood[]) => LoggedFood[]) => void
  /** Reads the days-logged count again, as removing a day's last food can lower it. */
  refreshDays: () => void
}

/** The foods logged on one day, and how many days the person has logged in all. */
export function useDayLogs(dateKey: string): DayLogs {
  const { client } = useAuth()
  const [logs, setLogs] = useState<LoggedFood[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [daysLogged, setDaysLogged] = useState<number | null>(null)
  // Only the newest request may update the screen, so a slow older answer never wins.
  const latest = useRef(0)

  const load = useCallback(() => {
    const request = ++latest.current
    fetchDayLogs(client, dateKey).then(
      (next) => {
        if (request !== latest.current) return
        setLogs(next)
        setError(null)
      },
      (failure: unknown) => {
        if (request !== latest.current) return
        setError(
          failure instanceof LogError
            ? failure.message
            : "We couldn't load your food for today. Check your connection and try again.",
        )
      },
    )
    // The count is a nice extra: if it can't be read, the pill just stays hidden.
    fetchDaysLogged(client).then(
      (count) => {
        if (request === latest.current) setDaysLogged(count)
      },
      () => undefined,
    )
  }, [client, dateKey])

  useEffect(() => {
    load()
    return () => {
      latest.current += 1
    }
  }, [load])

  const reload = useCallback(() => {
    setError(null)
    load()
  }, [load])

  const update = useCallback((change: (current: LoggedFood[]) => LoggedFood[]) => {
    setLogs((current) => (current ? change(current) : current))
  }, [])

  const refreshDays = useCallback(() => {
    fetchDaysLogged(client).then(setDaysLogged, () => undefined)
  }, [client])

  return { logs, error, daysLogged, reload, update, refreshDays }
}
