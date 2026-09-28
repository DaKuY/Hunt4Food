import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractHealthySignals, healthyInstantBoost, healthyQualityTier, matchKnownChain } from './healthySignals'
import { pickHealthyLanes } from './healthySearch'
import { buildAreaQuery } from './overpass'
import { discoverHealthyCandidates, HEALTHY_DISCOVERY_TERM_GROUPS } from './providerDiscovery'
import { isFastFood } from './rank'
import type { CitySelection, RankedRestaurant, Restaurant } from './types'

const place = (overrides: Partial<Restaurant>): Restaurant => ({
  id: overrides.name ?? 'x',
  name: 'x',
  lat: 30.27,
  lon: -97.74,
  cuisines: [],
  ...overrides,
})

function ranked(overrides: Partial<Restaurant>, score = 50): RankedRestaurant {
  const base = place(overrides)
  const boost = healthyInstantBoost(base)
  return { ...base, score, reasons: [], distanceKm: 1, lane: boost.lane, signals: boost.signals }
}

describe('healthy brands are not treated as fast food', () => {
  it('keeps Tropical Smoothie Cafe and Pure Green even when tagged fast food', () => {
    expect(isFastFood(place({ name: 'Tropical Smoothie Cafe', amenity: 'fast_food' }))).toBe(false)
    expect(isFastFood(place({ name: 'Tropical Smoothie Cafe', cuisines: ['fast_food_restaurant'] }))).toBe(false)
    expect(isFastFood(place({ name: 'Pure Green', amenity: 'fast_food' }))).toBe(false)
  })

  it('keeps local juice bars tagged fast food but still excludes real fast food', () => {
    expect(isFastFood(place({ name: 'Juice Land', amenity: 'fast_food', cuisines: ['juice'] }))).toBe(false)
    expect(isFastFood(place({ name: 'Burger Barn', amenity: 'fast_food' }))).toBe(true)
    expect(isFastFood(place({ name: 'Taco Bell', cuisines: ['juice'] }))).toBe(true)
  })
})

describe('healthy ranking', () => {
  it('puts True Food Kitchen, Tropical Smoothie Cafe and Pure Green in the top tier', () => {
    for (const name of ['True Food Kitchen', 'Tropical Smoothie Cafe', 'Pure Green']) {
      expect(healthyQualityTier(place({ name }), [])).toBe(0)
    }
  })

  it('treats steak as a whole-food protein, but not cheesesteak', () => {
    expect(extractHealthySignals('Grass-fed ribeye').map((s) => s.id)).toContain('steak')
    expect(extractHealthySignals('', 'listing')).toEqual([])
    expect(extractHealthySignals('Philly cheesesteak').map((s) => s.id)).not.toContain('steak')
    const steakhouse = place({ name: 'Local Chophouse', cuisines: ['steak_house'] })
    expect(healthyQualityTier(steakhouse, extractHealthySignals('steak_house'))).toBe(1)
    expect(healthyInstantBoost(steakhouse).lane).toBe('protein')
  })

  it('does not rank a bar & grill as a whole-food restaurant', () => {
    expect(healthyQualityTier(place({ name: "Buffalo Joe's Bar & Grill", cuisines: ['burger'] }), [])).toBe(3)
  })

  it('matches chain names on whole words only', () => {
    expect(matchKnownChain(place({ name: 'Cavatappi Italian' }))).toBeNull()
    expect(matchKnownChain(place({ name: 'Green' }))).toBeNull()
    expect(matchKnownChain(place({ name: 'Tropical Smoothie Cafe - Lamar' }))?.name).toBe('Tropical Smoothie Cafe')
  })

  it('shows one location per chain and a mix of lanes', () => {
    const pool = [
      ranked({ id: 'ts1', name: 'Tropical Smoothie Cafe' }, 90),
      ranked({ id: 'ts2', name: 'Tropical Smoothie Cafe' }, 89),
      ranked({ id: 'ts3', name: 'Tropical Smoothie Cafe' }, 88),
      ranked({ id: 'sk', name: 'Smoothie King' }, 87),
      ranked({ id: 'pg', name: 'Pure Green' }, 86),
      ranked({ id: 'nk', name: 'Nekter Juice Bar' }, 85),
      ranked({ id: 'tf', name: 'True Food Kitchen' }, 70),
      ranked({ id: 'st', name: 'Local Chophouse', cuisines: ['steak_house'] }, 60),
      ranked({ id: 'sal', name: 'Salmon Shack', cuisines: ['seafood'] }, 55),
      ranked({ id: 'bar', name: 'Sports Bar & Grill', cuisines: ['burger'] }, 99),
    ]
    const top = pickHealthyLanes(pool, 6).map((p) => p.id)
    expect(top.filter((id) => id.startsWith('ts'))).toEqual(['ts1'])
    expect(top).toEqual(expect.arrayContaining(['tf', 'pg', 'st', 'sal']))
    expect(top).not.toContain('bar')
    expect(top).not.toContain('nk') // smoothie lane capped at half the list
  })

  it('still returns every place when asked for the full list', () => {
    const pool = [
      ranked({ id: 'ts1', name: 'Tropical Smoothie Cafe' }, 90),
      ranked({ id: 'ts2', name: 'Tropical Smoothie Cafe' }, 89),
    ]
    expect(pickHealthyLanes(pool, pool.length).map((p) => p.id)).toEqual(['ts1', 'ts2'])
  })
})

describe('healthy discovery', () => {
  it('asks OSM for healthy shops filed under fast_food', () => {
    const query = buildAreaQuery({ south: 30.2, west: -97.8, north: 30.3, east: -97.7 }, true)
    expect(query).toMatch(/\["amenity"="fast_food"\]\["name"~"[^"]*tropical smoothie[^"]*pure green[^"]*",i\]/)
    expect(query).toContain('["amenity"="fast_food"]["cuisine"~"juice|smoothie|salad|acai",i]')
    expect(buildAreaQuery({ south: 30.2, west: -97.8, north: 30.3, east: -97.7 })).not.toContain('fast_food')
  })

  afterEach(() => vi.unstubAllGlobals())

  it('searches providers for the named healthy brands and dishes', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(new URL(url, 'https://x').searchParams.get('terms') ?? '')
      return new Response(JSON.stringify({ places: [] }), { status: 200 })
    })
    const city: CitySelection = {
      label: 'Austin',
      center: { lat: 30.27, lon: -97.74 },
      bounds: { south: 30.2, west: -97.8, north: 30.3, east: -97.7 },
      source: 'search',
    }
    await discoverHealthyCandidates(city)
    expect(calls).toEqual(HEALTHY_DISCOVERY_TERM_GROUPS.map((group) => group.join('|')))
    expect(calls.join('|')).toContain('True Food Kitchen')
    expect(calls.join('|')).toContain('grass fed steak')
  })
})
