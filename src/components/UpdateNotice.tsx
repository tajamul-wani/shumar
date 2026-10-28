import { useEffect, useRef, useState } from 'react'
import { applyUpdate, onUpdateReady } from '../lib/serviceWorker.ts'
import { Toast, type ToastMessage } from './Toast.tsx'

/** Long enough to notice; if it goes, coming back to the app shows it again. */
const SHOWN_FOR_MS = 20_000

/**
 * Says when a new version of the app is ready, with Refresh to use it. Until then the page keeps
 * running the version it opened with, so nothing a person is in the middle of is lost.
 */
export function UpdateNotice() {
  const [message, setMessage] = useState<ToastMessage | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const nextId = useRef(0)

  useEffect(
    () =>
      onUpdateReady(() => {
        nextId.current += 1
        setMessage({
          id: nextId.current,
          text: 'New version ready',
          detail: 'Refresh to use it',
          tone: 'update',
        })
      }),
    [],
  )

  return (
    <Toast
      message={message}
      duration={SHOWN_FOR_MS}
      onDismiss={() => setMessage(null)}
      aboveAddButton
      action={{
        label: 'Refresh',
        busy: refreshing,
        onClick: () => {
          if (refreshing) return
          setRefreshing(true)
          applyUpdate()
        },
      }}
    />
  )
}
