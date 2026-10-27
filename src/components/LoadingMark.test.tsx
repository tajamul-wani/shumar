import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LoadingMark } from './LoadingMark.tsx'
import { MARK_TRACK_LENGTH } from './markShape.ts'

afterEach(() => vi.unstubAllGlobals())

function allowMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

const saffron = (container: HTMLElement) => container.querySelector('path.stroke-deficit-ring')

it('runs a quarter of the track round the hexagon, hidden from screen readers', () => {
  allowMotion()
  const { container } = render(<LoadingMark />)
  const svg = container.querySelector('svg')
  expect(svg).toHaveAttribute('aria-hidden', 'true')
  expect(svg).toHaveClass('animate-mark-appear', 'size-loading-mark')
  expect(saffron(container)).toHaveClass('animate-mark-run')
  expect(saffron(container)).toHaveAttribute(
    'stroke-dasharray',
    `${MARK_TRACK_LENGTH / 4} ${(MARK_TRACK_LENGTH * 3) / 4}`,
  )
  expect(container.querySelectorAll('path')).toHaveLength(5)
})

it('is the logo standing still when the device asks for less motion', () => {
  // The test setup reports reduced motion by default.
  const { container } = render(<LoadingMark />)
  expect(saffron(container)).not.toHaveClass('animate-mark-run')
  expect(saffron(container)).toHaveAttribute(
    'stroke-dasharray',
    `${0.72 * MARK_TRACK_LENGTH} ${MARK_TRACK_LENGTH}`,
  )
})
