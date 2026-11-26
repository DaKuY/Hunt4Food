import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8').toLowerCase()
const appCss = readFileSync(new URL('./App.css', import.meta.url), 'utf8')

describe('Base Camp brand tokens', () => {
  it('defines the shared lodge palette at :root', () => {
    expect(css).toContain('--ivory: #fbf3ec')
    expect(css).toContain('--forest: #0a4a2a')
    expect(css).toContain('--brass: #85632a')
  })

  it('grounds the page in ivory and keeps primary buttons forest', () => {
    expect(css).toMatch(/--bg-ink:\s*var\(--ivory\)/)
    expect(appCss).toMatch(/\.btn\.primary\s*\{[^}]*var\(--forest\)/)
  })
})
