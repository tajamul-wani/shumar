import { describe, expect, it } from 'vitest'
// @ts-expect-error The checker is a plain Node script without type declarations.
import { findThemeColorDrift, findViolations } from './check-design-tokens.mjs'

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

describe('status bar color check', () => {
  const css =
    "[data-theme='dark'] {\n  --koshur-base: #0c0b0a;\n}\n[data-theme='light'] {\n  --koshur-base: #f7f4ee;\n}"
  const themeInit = "meta.content = theme === 'light' ? '#F7F4EE' : '#0C0B0A'"
  const html = '<meta name="theme-color" content="#0C0B0A" />'

  it('accepts colors that match the tokens, in any letter case', () => {
    expect(findThemeColorDrift({ css, themeInit, html })).toEqual([])
  })

  it('flags theme-init.js when either color drifts', () => {
    const drifted = themeInit.replace('#F7F4EE', '#FFFFFF')
    expect(findThemeColorDrift({ css, themeInit: drifted, html })[0]).toContain('public/theme-init.js')
    expect(findThemeColorDrift({ css, themeInit: 'no colors here', html })[0]).toContain(
      'public/theme-init.js',
    )
  })

  it('flags the theme-color meta when it drifts', () => {
    const drifted = html.replace('#0C0B0A', '#000000')
    expect(findThemeColorDrift({ css, themeInit, html: drifted })).toEqual([
      'index.html: the theme-color meta must be the dark koshur-base, #0c0b0a',
    ])
  })

  it('flags a token file without both base colors', () => {
    expect(findThemeColorDrift({ css: '', themeInit, html })[0]).toContain('koshur-base is missing')
  })
})
