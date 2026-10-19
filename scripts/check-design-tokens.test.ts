import { describe, expect, it } from 'vitest'
// @ts-expect-error The checker is a plain Node script without type declarations.
import { findViolations } from './check-design-tokens.mjs'

describe('design token check', () => {
  it('accepts token classes', () => {
    const ok = '<p className="m-0 text-body font-semibold text-koshur-muted bg-koshur-surface font-wordmark">'
    expect(findViolations(ok)).toEqual([])
  })

  it.each([
    ['a raw hex color', 'style={{ color: "#123456" }}'],
    ['a color function', 'background: rgb(1, 2, 3);'],
    ['an arbitrary value', '<div className="text-[17px]">'],
    ['a default text size', '<h1 className="text-2xl">'],
    ['a weight outside the scale', '<b className="font-bold">'],
    ['an unapproved font', '<code className="font-mono">'],
    ['a font defined in place', 'font-family: Arial;'],
    ['an inline style value', "<div style={{ fontSize: '17px' }}>"],
  ])('flags %s', (_, line) => {
    expect(findViolations(line)).not.toEqual([])
  })

  it('reports the file and line', () => {
    expect(findViolations('ok\n<h1 className="text-2xl">', 'src/App.tsx')[0]).toContain('src/App.tsx:2')
  })
})
