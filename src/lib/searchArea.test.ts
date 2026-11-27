import { describe, expect, it } from 'vitest'
import {
  distanceMeters,
  FRESH_FIX_MS,
  locationProblem,
  needsNewFix,
  stillInArea,
  townLabel,
  wantsPhoneLocation,
} from './searchArea'
import { parseSearchQuery } from './queryParser'
import type { CitySelection } from './types'

const coppell: CitySelection = {
  label: 'Coppell, Texas, United States',
  center: { lat: 32.9546, lon: -97.015 },
  bounds: { south: 32.92, west: -97.05, north: 32.99, east: -96.97 },
  source: 'map',
}
const downtownDallas = { lat: 32.7795, lon: -96.8003 }

describe('where a search with no place typed runs', () => {
  it('uses the phone’s location unless an area was chosen', () => {
    expect(wantsPhoneLocation(null, false)).toBe(true)
    expect(wantsPhoneLocation('here', false)).toBe(true)
    // The last area from an earlier visit is never assumed.
    expect(wantsPhoneLocation('saved', false)).toBe(true)
    expect(wantsPhoneLocation('chosen', false)).toBe(false)
  })

  it('always uses the phone’s location for "near me"', () => {
    expect(wantsPhoneLocation('chosen', true)).toBe(true)
  })

  it('the "Healthy near me" pick asks for the phone’s location', () => {
    const parsed = parseSearchQuery('healthy near me')
    expect(parsed.nearMe).toBe(true)
    expect(parsed.healthy).toBe(true)
    expect(parsed.location).toBeNull()
  })
})

describe('phone fixes', () => {
  it('reuses a fix for two minutes', () => {
    expect(needsNewFix(null, 1000)).toBe(true)
    expect(needsNewFix(0, FRESH_FIX_MS)).toBe(false)
    expect(needsNewFix(0, FRESH_FIX_MS + 1)).toBe(true)
  })

  it('keeps the current area only while the phone is still in it', () => {
    const nearby = { lat: coppell.center.lat + 0.005, lon: coppell.center.lon }
    expect(stillInArea('here', coppell, nearby)).toBe(true)
    expect(stillInArea('here', coppell, downtownDallas)).toBe(false)
    // A saved or chosen area is never kept as "here".
    expect(stillInArea('saved', coppell, nearby)).toBe(false)
    expect(stillInArea('chosen', coppell, nearby)).toBe(false)
    expect(stillInArea('here', null, nearby)).toBe(false)
  })

  it('measures distance in meters', () => {
    const km = distanceMeters(coppell.center, downtownDallas) / 1000
    expect(km).toBeGreaterThan(27)
    expect(km).toBeLessThan(31)
  })

  it('explains a blocked location on iPhone', () => {
    expect(locationProblem('denied')).toMatch(/Safari Websites/)
    expect(locationProblem('unavailable')).toMatch(/near <city>/)
  })
})

describe('townLabel', () => {
  it('names the town, not the street, for a point', () => {
    expect(
      townLabel({ name: 'West Bethel Road', type: 'street', city: 'Coppell', county: 'Dallas', state: 'Texas', country: 'United States' }),
    ).toBe('Coppell, Texas, United States')
  })

  it('uses the name when the feature is the town itself', () => {
    expect(townLabel({ name: 'Coppell', type: 'city', state: 'Texas', country: 'United States' })).toBe('Coppell, Texas, United States')
  })

  it('falls back to the county, then the name', () => {
    expect(townLabel({ name: 'FM 1938', type: 'street', county: 'Denton County', state: 'Texas' })).toBe('Denton County, Texas')
    expect(townLabel({ name: 'Somewhere' })).toBe('Somewhere')
    expect(townLabel({})).toBeNull()
  })
})
