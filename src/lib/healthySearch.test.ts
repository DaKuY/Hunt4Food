import { describe, expect, it } from 'vitest'
import { healthySearchCacheKey } from './healthySearch'
import { emptyTaste } from './taste'
import type { CitySelection } from './types'

const city: CitySelection = {
  label: 'Test City',
  center: { lat: 32.95, lon: -96.99 },
  bounds: { south: 32.9, west: -97.04, north: 33, east: -96.94 },
  source: 'search',
}

describe('healthySearchCacheKey', () => {
  it('separates cuisine, dietary, keyword, and taste-specific searches', () => {
    const taste = emptyTaste()
    const base = healthySearchCacheKey(city, ['healthy', 'salmon'], [], '', taste)

    expect(healthySearchCacheKey(city, ['healthy', 'steak'], [], '', taste)).not.toBe(base)
    expect(healthySearchCacheKey(city, ['healthy', 'salmon'], ['gluten_free'], '', taste)).not.toBe(base)
    expect(healthySearchCacheKey(city, ['healthy', 'salmon'], [], 'grass fed', taste)).not.toBe(base)

    const likedTaste = {
      ...taste,
      loved: [
        {
          id: 'fav-1',
          name: 'Favorite',
          cuisines: ['seafood'],
          rating: 5,
          vibeTags: [],
          savedAt: new Date(0).toISOString(),
        },
      ],
    }
    expect(healthySearchCacheKey(city, ['healthy', 'salmon'], [], '', likedTaste)).not.toBe(base)
  })

  it('is stable when selection order changes', () => {
    const taste = emptyTaste()
    const a = healthySearchCacheKey(city, ['healthy', 'salmon'], ['vegan', 'gluten_free'], ' Salmon ', taste)
    const b = healthySearchCacheKey(city, ['salmon', 'healthy'], ['gluten_free', 'vegan'], 'salmon', taste)
    expect(a).toBe(b)
  })
})
