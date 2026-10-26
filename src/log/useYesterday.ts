import { useEffect, useState } from 'react'
import { useAuth } from '../auth/context.ts'
import { addDays, localDateKey } from '../lib/dates.ts'
import { fetchDayLogs, type LoggedFood } from '../lib/dayLogs.ts'

/** What the person logged yesterday, so a meal can be repeated in one tap. Empty if it can't be read. */
export function useYesterday(): LoggedFood[] {
  const { client } = useAuth()
  const [logs, setLogs] = useState<LoggedFood[]>([])
  useEffect(() => {
    let live = true
    fetchDayLogs(client, localDateKey(addDays(new Date(), -1))).then(
      (next) => {
        if (live) setLogs(next)
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [client])
  return logs
}
