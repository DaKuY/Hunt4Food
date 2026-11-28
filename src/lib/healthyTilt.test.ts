import { describe, expect, it } from 'vitest'
import { healthyTilt, rankRestaurants } from './rank'
import type { Restaurant } from './types'
import { emptyTaste } from './taste'

const place = (over: Partial<Restaurant>): Restaurant => ({
  id: over.name ?? 'x',
  name: 'Place',
  lat: 33.0,
  lon: -97.0,
  cuisines: ['mexican'],
  amenity: 'restaurant',
  ...over,
})

describe('healthy tilt in every search', () => {
  it('lifts places with clean-food evidence from Google descriptions', () => {
    const clean = healthyTilt(place({ name: 'Verde', description: 'Grass-fed carne asada, organic produce, no seed oils' }))
    const plain = healthyTilt(place({ name: 'Casa Plain' }))
    expect(clean.points).toBeGreaterThan(plain.points)
    expect(clean.reasons[0]).toMatch(/^Healthier pick/)
  })

  it('sinks dessert-only spots', () => {
    expect(healthyTilt(place({ name: 'Sweet Cakes', cuisines: ['dessert', 'bakery'] })).points).toBeLessThan(0)
  })

  it('ranks the healthy Mexican kitchen above an equal plain one', () => {
    const ranked = rankRestaurants(
      [
        place({ id: 'plain', name: 'Casa Plain', website: 'https://a.example', providerRating: 4.5, providerReviewCount: 300 }),
        place({ id: 'clean', name: 'Verde Kitchen', website: 'https://b.example', providerRating: 4.5, providerReviewCount: 300,
          description: 'Organic, grass-fed and wild-caught; cooked in avocado oil' }),
      ],
      { center: { lat: 33, lon: -97 }, selectedCuisines: ['mexican'], dietary: [], taste: emptyTaste(), onlyMatchingCuisines: true },
    )
    expect(ranked[0]!.id).toBe('clean')
  })
})
