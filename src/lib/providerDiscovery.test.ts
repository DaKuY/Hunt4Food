import { describe, expect, it } from 'vitest'
import { buildDiscoveryTerms, mergeProviderCandidates, type ProviderCandidate } from './providerDiscovery'
import type { Restaurant } from './types'

function osm(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: overrides.id ?? 'osm/1',
    name: overrides.name ?? 'Local Grill',
    lat: overrides.lat ?? 32.95,
    lon: overrides.lon ?? -96.99,
    cuisines: overrides.cuisines ?? ['american'],
    amenity: overrides.amenity ?? 'restaurant',
    ...overrides,
  }
}

function provider(overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  return {
    source: overrides.source ?? 'google',
    id: overrides.id ?? 'g-1',
    name: overrides.name ?? 'Local Grill',
    lat: overrides.lat ?? 32.9505,
    lon: overrides.lon ?? -96.9904,
    categories: overrides.categories ?? ['steak_house'],
    rating: overrides.rating ?? 4.8,
    reviewCount: overrides.reviewCount ?? 1200,
    matchedTerm: overrides.matchedTerm ?? 'Steak',
    ...overrides,
  }
}

describe('buildDiscoveryTerms', () => {
  it('prefers an explicit keyword and keeps unique cuisine terms', () => {
    expect(buildDiscoveryTerms(['steak', 'seafood', 'steak'], 'grass fed')).toEqual([
      'grass fed',
      'Steak',
      'Seafood',
    ])
  })

  it('does not send the generic Healthy label through normal provider discovery', () => {
    expect(buildDiscoveryTerms(['healthy', 'salmon'], '')).toEqual(['Salmon'])
  })
})

describe('mergeProviderCandidates', () => {
  it('enriches a nearby matching OSM restaurant instead of duplicating it', () => {
    const merged = mergeProviderCandidates(
      [osm()],
      [
        provider({
          address: '123 Main St',
          website: 'https://example.com',
          phone: '555-0100',
        }),
      ],
      'Test City',
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      id: 'osm/1',
      address: '123 Main St',
      website: 'https://example.com',
      phone: '555-0100',
      providerRating: 4.8,
      providerReviewCount: 1200,
    })
    expect(merged[0]?.discoveryTerms).toContain('Steak')
    expect(merged[0]?.cuisines).toContain('steak_house')
  })

  it('adds provider-only restaurants to the candidate pool', () => {
    const merged = mergeProviderCandidates(
      [],
      [provider({ id: 'google-only', name: 'Provider Steakhouse' })],
      'Test City',
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      id: 'google/google-only',
      name: 'Provider Steakhouse',
      amenity: 'restaurant',
      providerRating: 4.8,
    })
  })

  it('keeps separate same-name locations when they are far apart', () => {
    const merged = mergeProviderCandidates(
      [osm({ name: 'Local Grill', lat: 32.95, lon: -96.99 })],
      [provider({ name: 'Local Grill', lat: 33.05, lon: -96.89 })],
      'Test City',
    )
    expect(merged).toHaveLength(2)
  })

  it('keeps the stronger review-volume provider rating when sources merge', () => {
    const merged = mergeProviderCandidates(
      [osm()],
      [
        provider({ source: 'google', rating: 4.9, reviewCount: 25 }),
        provider({ source: 'yelp', id: 'y-1', rating: 4.6, reviewCount: 900 }),
      ],
      'Test City',
    )

    expect(merged[0]?.providerRating).toBe(4.6)
    expect(merged[0]?.providerReviewCount).toBe(900)
    expect(merged[0]?.yelpId).toBe('y-1')
  })
})
