import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toast, type ToastMessage } from './Toast.tsx'

const first: ToastMessage = { id: 1, text: 'Removed from breakfast', detail: 'Test tea', tone: 'removed' }
const second: ToastMessage = { id: 2, text: 'Put back in breakfast', detail: 'Test tea', tone: 'added' }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))

describe('Toast', () => {
  it('keeps its announcement region on the page even with no message', () => {
    render(<Toast message={null} duration={5000} onDismiss={() => undefined} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('shows the message and closes after its time', () => {
    const onDismiss = vi.fn<() => void>()
    render(<Toast message={first} duration={5000} onDismiss={onDismiss} />)
    expect(screen.getByRole('status')).toHaveTextContent('Removed from breakfast · Test tea')
    wait(4999)
    expect(onDismiss).not.toHaveBeenCalled()
    wait(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('marks added foods in saffron with a check and removed ones in gray with a bin', () => {
    const { rerender } = render(<Toast message={second} duration={5000} onDismiss={() => undefined} />)
    expect(screen.getByRole('status')).toHaveClass('border-l-deficit-ring')
    expect(screen.getByRole('status').querySelector('svg')).toHaveClass('lucide-check')
    rerender(<Toast message={first} duration={5000} onDismiss={() => undefined} />)
    expect(screen.getByRole('status')).toHaveClass('border-l-koshur-muted')
    expect(screen.getByRole('status').querySelector('svg')).toHaveClass('lucide-trash-2')
  })

  it('shows a short message and reads its detail aloud without showing it', () => {
    render(<Toast message={first} duration={5000} onDismiss={() => undefined} />)
    expect(screen.getByText('Test tea', { exact: false })).toHaveClass('sr-only')
  })

  it('runs its action', () => {
    const onClick = vi.fn<() => void>()
    render(
      <Toast
        message={first}
        duration={8000}
        onDismiss={() => undefined}
        action={{ label: 'Undo', onClick }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('waits while its button has focus, then closes once focus leaves', () => {
    const onDismiss = vi.fn<() => void>()
    render(
      <Toast
        message={first}
        duration={8000}
        onDismiss={onDismiss}
        action={{ label: 'Undo', onClick: () => undefined }}
      />,
    )
    const undo = screen.getByRole('button', { name: 'Undo' })
    fireEvent.focusIn(undo)
    wait(60000)
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.focusOut(undo)
    wait(8000)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('waits while it is touched or hovered', () => {
    const onDismiss = vi.fn<() => void>()
    render(<Toast message={first} duration={5000} onDismiss={onDismiss} />)
    const toast = screen.getByRole('status')
    fireEvent.pointerEnter(toast)
    wait(60000)
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.pointerLeave(toast)
    wait(5000)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('gives a new message a fresh, unpaused timer, even if the focused button just vanished', () => {
    const onDismiss = vi.fn<() => void>()
    const { rerender } = render(
      <Toast
        message={first}
        duration={8000}
        onDismiss={onDismiss}
        action={{ label: 'Undo', onClick: () => undefined }}
      />,
    )
    fireEvent.focusIn(screen.getByRole('button', { name: 'Undo' }))
    // Undo worked: a new message replaces it, and the button is gone without a focusout.
    rerender(<Toast message={second} duration={5000} onDismiss={onDismiss} />)
    expect(screen.getByRole('status')).toHaveTextContent('Put back in breakfast · Test tea')
    wait(5000)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('on phones sits beside the round add button, or above it when it needs the whole line', () => {
    const { container, rerender } = render(
      <Toast message={first} duration={5000} onDismiss={() => undefined} besideAddButton />,
    )
    expect(container.firstElementChild).toHaveClass('bottom-above-tab-bar', 'right-24')
    rerender(<Toast message={first} duration={5000} onDismiss={() => undefined} aboveAddButton />)
    expect(container.firstElementChild).toHaveClass('bottom-above-add-button', 'right-4')
    expect(container.firstElementChild).not.toHaveClass('bottom-above-tab-bar')
  })
})
