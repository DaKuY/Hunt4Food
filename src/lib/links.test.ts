import { describe, expect, it, vi } from 'vitest'
import { buildSearchShareUrl, menuOrWebsiteUrl, safeExternalUrl } from './links'
import { BUILTIN_RATINGS_PROXY_URL, isAllowedProxyUrl } from './ratingsProxy'
import type { Restaurant } from './types'

const place = (website?: string): Restaurant => ({
  id: 'node/1',
  name: 'Taqueria',
  lat: 0,
  lon: 0,
  cuisines: [],
  cuisineRaw: '',
  website,
})

describe('safeExternalUrl', () => {
  it('keeps http(s) links', () => {
    expect(safeExternalUrl('https://www.yelp.com/biz/x', 'fb')).toBe('https://www.yelp.com/biz/x')
    expect(safeExternalUrl('http://example.com/', 'fb')).toBe('http://example.com/')
  })

  it('falls back for script and malformed URLs', () => {
    expect(safeExternalUrl('javascript:alert(1)', 'fb')).toBe('fb')
    expect(safeExternalUrl('data:text/html,hi', 'fb')).toBe('fb')
    expect(safeExternalUrl('not a url', 'fb')).toBe('fb')
    expect(safeExternalUrl(undefined, 'fb')).toBe('fb')
  })
})

describe('menuOrWebsiteUrl', () => {
  it('adds https to bare OSM website tags', () => {
    expect(menuOrWebsiteUrl(place('taqueria.example'), 'Austin').href).toBe('https://taqueria.example/')
  })

  it('falls back to a menu search for unusable website tags', () => {
    const link = menuOrWebsiteUrl(place('https://'), 'Austin')
    expect(link.label).toBe('Find menu')
    expect(link.href.startsWith('https://www.google.com/search?q=')).toBe(true)
  })
})

describe('isAllowedProxyUrl', () => {
  it('accepts Apps Script web-app URLs', () => {
    expect(isAllowedProxyUrl(BUILTIN_RATINGS_PROXY_URL)).toBe(true)
    expect(isAllowedProxyUrl('https://script.google.com/a/example.com/macros/s/AKfy-1_x/exec')).toBe(true)
  })

  it('rejects any other script source', () => {
    expect(isAllowedProxyUrl('https://evil.example/exec')).toBe(false)
    expect(isAllowedProxyUrl('https://script.google.com.evil.example/macros/s/x/exec')).toBe(false)
    expect(isAllowedProxyUrl('http://script.google.com/macros/s/x/exec')).toBe(false)
    expect(isAllowedProxyUrl('https://script.google.com/macros/s/x/exec?callback=alert')).toBe(false)
  })
})

describe('buildSearchShareUrl', () => {
  it('shares the place, not the sharer’s "near me" flag', () => {
    vi.stubGlobal('window', { location: { origin: 'https://food.example', pathname: '/' } })
    const params = new URLSearchParams('city=Coppell&lat=32.95&lon=-97.01&here=1&cuisines=healthy')
    const url = buildSearchShareUrl(params)
    vi.unstubAllGlobals()
    expect(url.startsWith('https://food.example/#/?')).toBe(true)
    expect(url).toContain('city=Coppell')
    expect(url).toContain('cuisines=healthy')
    expect(url).not.toContain('here=')
    // The page's own params are untouched.
    expect(params.get('here')).toBe('1')
  })
})
