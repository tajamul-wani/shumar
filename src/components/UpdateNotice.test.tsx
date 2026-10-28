import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { resetUpdates, watchForUpdates } from '../lib/serviceWorker.ts'
import { UpdateNotice } from './UpdateNotice.tsx'

afterEach(() => resetUpdates())

/** A new version installed and waiting, as the browser reports it. */
function newVersionWaiting() {
  const postMessage = vi.fn<(message: unknown) => void>()
  const registration = {
    waiting: { postMessage },
    addEventListener: () => undefined,
    update: async () => undefined,
  } as unknown as ServiceWorkerRegistration
  watchForUpdates(registration, {
    controller: () => ({}) as ServiceWorker,
    document: { visibilityState: 'visible', addEventListener: () => undefined },
  })
  return postMessage
}

it('says nothing until a new version is ready', () => {
  render(<UpdateNotice />)
  expect(screen.queryByText('New version ready')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
})

it('says a new version is ready, and Refresh asks it to take over, once', async () => {
  vi.stubGlobal('navigator', { ...navigator, serviceWorker: { addEventListener: vi.fn<() => void>() } })
  render(<UpdateNotice />)
  const postMessage = newVersionWaiting()
  expect(await screen.findByText('New version ready')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('New version ready · Refresh to use it')
  // The whole line, above the round add button, never over it.
  expect(screen.getByRole('status').parentElement).toHaveClass('bottom-above-add-button')
  const refresh = screen.getByRole('button', { name: 'Refresh' })
  await userEvent.click(refresh)
  await userEvent.click(refresh)
  expect(postMessage).toHaveBeenCalledTimes(1)
  expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  expect(refresh).toHaveAttribute('aria-disabled', 'true')
  vi.unstubAllGlobals()
})
