import { describe, expect, it } from 'vitest'
import {
  extractHealthySignals,
  healthyQualityTier,
  healthySignalScore,
} from './healthySignals'
import type { Restaurant } from './types'

function place(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: overrides.id ?? 'place-1',
    name: overrides.name ?? 'Neighborhood Kitchen',
    lat: overrides.lat ?? 32.95,
    lon: overrides.lon ?? -96.99,
    cuisines: overrides.cuisines ?? ['american'],
    ...overrides,
  }
}

describe('extractHealthySignals', () => {
  it('finds explicit sourcing and cooking-quality language', () => {
    const signals = extractHealthySignals(
      'Organic vegetables, 100% grass-fed beef, wild-caught salmon and no seed oils; cooked with avocado oil.',
      'google_snippet',
    )
    expect(signals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining(['organic', 'grass_fed', 'wild_caught', 'no_seed_oils', 'avocado_oil', 'salmon']),
    )
  })

  it('weights clean-food evidence above a simple salmon mention', () => {
    const clean = extractHealthySignals('No seed oils and grass-fed beef', 'yelp_review')
    const salmon = extractHealthySignals('Grilled salmon', 'listing')
    expect(healthySignalScore(clean)).toBeGreaterThan(healthySignalScore(salmon))
  })
})

describe('healthyQualityTier', () => {
  it('puts explicit clean-food evidence and True Food Kitchen first', () => {
    const cleanSignals = extractHealthySignals('Grass-fed beef with avocado oil', 'listing')
    expect(healthyQualityTier(place({ name: 'Local Farm Kitchen' }), cleanSignals)).toBe(0)
    expect(healthyQualityTier(place({ name: 'True Food Kitchen' }), [])).toBe(0)
  })

  it('uses salmon and quality full-service examples as the next fallback tier', () => {
    const salmonSignals = extractHealthySignals('Grilled salmon', 'listing')
    expect(healthyQualityTier(place({ name: 'Local Seafood Grill', cuisines: ['seafood'] }), salmonSignals)).toBe(1)
    expect(healthyQualityTier(place({ name: 'Moxies' }), [])).toBe(1)
    expect(healthyQualityTier(place({ name: 'Sakuu' }), [])).toBe(1)
  })

  it('keeps smoothie-only and generic weak matches below clean-food and quality fallbacks', () => {
    const smoothieSignals = extractHealthySignals('Smoothies and acai bowls', 'listing')
    expect(healthyQualityTier(place({ name: 'Neighborhood Juice', cuisines: ['juice'] }), smoothieSignals)).toBe(2)
    expect(healthyQualityTier(place({ name: 'Generic Pizza', cuisines: ['pizza'] }), [])).toBe(3)
  })
})
