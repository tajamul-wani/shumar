import { useEffect, useRef, useState } from 'react'
import { onAppInstalled } from '../lib/install.ts'
import { Toast, type ToastMessage } from './Toast.tsx'

/**
 * Chrome installs the app but leaves the person in the browser tab, which can leave them unsure
 * where it went. This says so, in one line on any phone.
 */
export function InstallNotice() {
  const [message, setMessage] = useState<ToastMessage | null>(null)
  const nextId = useRef(0)
  useEffect(
    () =>
      onAppInstalled(() => {
        nextId.current += 1
        setMessage({ id: nextId.current, text: 'Added to your home screen', tone: 'added' })
      }),
    [],
  )
  return <Toast message={message} duration={6000} onDismiss={() => setMessage(null)} aboveAddButton />
}
