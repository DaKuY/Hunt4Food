import { describe, expect, it } from 'vitest'
import { isFastFood, rankRestaurants } from './rank'
import type { Restaurant, TasteProfile } from './types'

const taste: TasteProfile = {
  version: 1,
  loved: [],
  skipped: [],
  cuisineWeights: {},
  dietaryPrefs: [],
  vibeWeights: {},
}

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

describe('isFastFood', () => {
  it('detects fast-food map/category signals', () => {
    expect(isFastFood(place({ amenity: 'fast_food' }))).toBe(true)
    expect(isFastFood(place({ cuisines: ['fast_food_restaurant'] }))).toBe(true)
  })

  it('detects recognizable fast-food chains even without category metadata', () => {
    expect(isFastFood(place({ name: "McDonald's - Main St" }))).toBe(true)
    expect(isFastFood(place({ name: 'Chick-fil-A Coppell' }))).toBe(true)
    expect(isFastFood(place({ name: 'Whataburger' }))).toBe(true)
  })

  it('does not classify quality restaurant examples as fast food', () => {
    expect(isFastFood(place({ name: 'True Food Kitchen' }))).toBe(false)
    expect(isFastFood(place({ name: 'Moxies' }))).toBe(false)
    expect(isFastFood(place({ name: 'Sakuu' }))).toBe(false)
  })
})

describe('rankRestaurants', () => {
  it('always excludes fast food, even when the old optional toggle is false', () => {
    const ranked = rankRestaurants(
      [
        place({ id: 'mcd', name: "McDonald's", amenity: 'restaurant' }),
        place({ id: 'true-food', name: 'True Food Kitchen', amenity: 'restaurant' }),
      ],
      {
        center: { lat: 32.95, lon: -96.99 },
        selectedCuisines: ['american'],
        dietary: [],
        taste,
        limit: 10,
        excludeFastFood: false,
      },
    )

    expect(ranked.map((restaurant) => restaurant.id)).toEqual(['true-food'])
  })
})
