import { describe, expect, it, vi } from 'vitest'
import { ensureHashRoute, leaveToLodge, LODGE_HOME } from './lodgeHome'

describe('LODGE_HOME', () => {
  it('is the Base Camp origin with a trailing slash', () => {
    expect(LODGE_HOME).toBe('https://andrewcamero.com/')
  })
})

describe('leaveToLodge', () => {
  it('preventDefault and assigns the lodge home origin', () => {
    const preventDefault = vi.fn()
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    leaveToLodge({ preventDefault })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith('https://andrewcamero.com/')
    vi.unstubAllGlobals()
  })
})

describe('ensureHashRoute', () => {
  it('replaceState adds #/ when the URL has no hash', () => {
    const replaceState = vi.fn()
    ensureHashRoute({
      location: { pathname: '/', search: '', hash: '' },
      history: { state: null, replaceState },
    })
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(replaceState).toHaveBeenCalledWith(null, '', '/#/')
  })

  it('replaceState keeps search params when adding the hash', () => {
    const replaceState = vi.fn()
    ensureHashRoute({
      location: { pathname: '/', search: '?utm=desk', hash: '#' },
      history: { state: { from: 'desk' }, replaceState },
    })
    expect(replaceState).toHaveBeenCalledWith({ from: 'desk' }, '', '/?utm=desk#/')
  })

  it('does not push or replace when a hash route already exists', () => {
    const replaceState = vi.fn()
    ensureHashRoute({
      location: { pathname: '/', search: '', hash: '#/' },
      history: { state: { x: 1 }, replaceState },
    })
    expect(replaceState).not.toHaveBeenCalled()
  })
})
