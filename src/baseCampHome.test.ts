import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const logoFile = '7D1A58C5-AFB4-4707-9696-BC085F5048A5.png'
const lodgeHome = 'https://andrewcamero.com/'

function topbarMarkup(): string {
  const header = app.match(/<header className="topbar">[\s\S]*?<\/header>/)
  expect(header).not.toBeNull()
  return header![0]
}

describe('Base Camp header control', () => {
  it('keeps the logo file in this repo', () => {
    expect(existsSync(join(root, 'public/logos', logoFile))).toBe(true)
  })

  it('uses a real <a href="https://andrewcamero.com/"> wrapping the local Base Camp img', () => {
    const header = topbarMarkup()
    const lodgeLink =
      /<a\b[^>]*\bhref=["']https:\/\/andrewcamero\.com\/["'][^>]*>[\s\S]*?<img\b[\s\S]*?<\/a>/
    const match = header.match(lodgeLink)
    expect(match).not.toBeNull()
    const html = match![0]
    expect(html).toContain(`href="${lodgeHome}"`)
    expect(html).toContain('aria-label="Base Camp home"')
    expect(html).toMatch(new RegExp(`/logos/${logoFile}`))
    expect(html).toMatch(/\balt=""/)
    expect(html).not.toMatch(/\btarget=/)
    expect(html).not.toMatch(/window\.open/)
    expect(header.indexOf(html)).toBeLessThan(header.indexOf('className="top-brand"'))
    expect(header).toContain('className="top-brand"')
  })

  it('is not a react-router or Next in-app link to "/"', () => {
    const header = topbarMarkup()
    const lodgeAnchor = header.match(
      /<a\b[^>]*\bhref=["']https:\/\/andrewcamero\.com\/["'][^>]*>[\s\S]*?<\/a>/,
    )
    expect(lodgeAnchor).not.toBeNull()
    expect(lodgeAnchor![0]).not.toMatch(/\bto=["']\/["']/)
    expect(header).not.toMatch(/<Link\b[^>]*\bto=["']\/["']/)
    expect(header).not.toMatch(/<Link\b[^>]*\bhref=["']https:\/\/andrewcamero\.com\//)
    expect(header).not.toMatch(/navigate\(/)
    expect(header).not.toMatch(/<Link\b[^>]*>[\s\S]*?7D1A58C5/)
  })
})
