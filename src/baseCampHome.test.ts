import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const main = readFileSync(join(root, 'src/main.tsx'), 'utf8')
const cityStep = readFileSync(join(root, 'src/components/CityStep.tsx'), 'utf8')
const lodge = readFileSync(join(root, 'src/lib/lodgeHome.ts'), 'utf8')
const logoFile = '7D1A58C5-AFB4-4707-9696-BC085F5048A5.png'
const lodgeHome = 'https://andrewcamero.com/'

function topbarMarkup(): string {
  const header = app.match(/<header className="topbar">[\s\S]*?<\/header>/)
  expect(header).not.toBeNull()
  return header![0]
}

function goHomeFn(): string {
  const match = app.match(/function goHome\(\) \{[\s\S]*?\n  \}/)
  expect(match).not.toBeNull()
  return match![0]
}

describe('Base Camp header control', () => {
  it('keeps the logo file in this repo', () => {
    expect(existsSync(join(root, 'public/logos', logoFile))).toBe(true)
  })

  it('uses a real <a href={LODGE_HOME}> wrapping the local Base Camp img', () => {
    const header = topbarMarkup()
    const lodgeLink =
      /<a\b[^>]*\bhref=\{LODGE_HOME\}[^>]*>[\s\S]*?<img\b[\s\S]*?<\/a>/
    const match = header.match(lodgeLink)
    expect(match).not.toBeNull()
    const html = match![0]
    expect(html).toContain('href={LODGE_HOME}')
    expect(html).toContain('onClick={leaveToLodge}')
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
      /<a\b[^>]*\bhref=\{LODGE_HOME\}[^>]*>[\s\S]*?<\/a>/,
    )
    expect(lodgeAnchor).not.toBeNull()
    const html = lodgeAnchor![0]
    expect(html).not.toMatch(/\bto=["']\/["']/)
    expect(html).not.toMatch(/goHome/)
    expect(html).not.toMatch(/navigate\(/)
    expect(html).not.toMatch(/history\.back/)
    expect(html).not.toMatch(/router\.back/)
    expect(header).not.toMatch(/<Link\b[^>]*\bto=["']\/["']/)
    expect(header).not.toMatch(/<Link\b[^>]*\bhref=["']https:\/\/andrewcamero\.com\//)
    expect(header).not.toMatch(/<Link\b[^>]*>[\s\S]*?7D1A58C5/)
  })
})

describe('leave-to-lodge path', () => {
  it('assigns https://andrewcamero.com/ in the same tab', () => {
    expect(lodge).toContain(`export const LODGE_HOME = '${lodgeHome}'`)
    const fn = lodge.match(/export function leaveToLodge\([\s\S]*?\n\}/)
    expect(fn).not.toBeNull()
    expect(fn![0]).toMatch(/window\.location\.assign\(LODGE_HOME\)/)
    expect(fn![0]).toMatch(/event\?\.preventDefault\(\)/)
    expect(fn![0]).not.toMatch(/target\s*=/)
    expect(fn![0]).not.toMatch(/history\.back/)
    expect(fn![0]).not.toMatch(/navigate\(/)
  })

  it('keeps BrandMark goHome as an in-app Hunt4Food reset', () => {
    const home = goHomeFn()
    expect(home).toContain("navigate('/', { replace: true, state: { reset: Date.now() } })")
    expect(home).not.toMatch(/andrewcamero/)
    expect(home).not.toMatch(/leaveToLodge/)
    expect(home).not.toMatch(/location\.assign/)
    expect(home).not.toMatch(/history\.back/)
    expect(app).toMatch(/<button type="button" className="top-brand" onClick=\{goHome\}/)
  })

  it('bootstraps the hash with replaceState before React mounts', () => {
    expect(main).toMatch(/ensureHashRoute\(\)\s*\n\s*\ncreateRoot\(/)
    expect(lodge).toMatch(/replaceState/)
    expect(lodge).not.toMatch(/pushState/)
  })

  it('does not push search-param history on city/cuisine bootstrap', () => {
    const calls = [...app.matchAll(/setParams\(/g)]
    expect(calls.length).toBe(4)
    expect(app).toContain('setParams(new URLSearchParams(), { replace: true })')
    expect((app.match(/\{ replace: true \}/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })

  it('sends first-screen Back to the lodge instead of bouncing city↔cuisine', () => {
    expect(app).toContain('onBack={leaveToLodge}')
    expect(app).toContain('onBack={backFromCuisine}')
    expect(app).toMatch(/function backFromCuisine\(\) \{[\s\S]*leaveToLodge\(\)/)
    expect(app).toMatch(/<CityStep[\s\S]*onBack=\{leaveToLodge\}/)
    expect(cityStep).toMatch(/<button type="button" className="btn ghost" onClick=\{onBack\}>\s*Back/)
    expect(app).not.toMatch(/onBack=\{\(\) => setStep\('city'\)\}/)
  })
})
