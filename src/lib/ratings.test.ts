import { describe, expect, it } from 'vitest'
import { ratingQualityAdjustment, type PlaceRatings, type SourceRating } from './ratings'

function source(
  sourceName: SourceRating['source'],
  rating: number | null,
  reviewCount: number | null,
): SourceRating {
  return {
    source: sourceName,
    rating,
    reviewCount,
    url: 'https://example.com',
  }
}

function ratings(
  google: SourceRating,
  yelp: SourceRating,
  tripadvisor: SourceRating,
): PlaceRatings {
  return {
    google,
    yelp,
    tripadvisor,
    price: { level: null, label: null, source: null },
  }
}

describe('ratingQualityAdjustment', () => {
  it('rewards strong ratings with meaningful review volume', () => {
    const strong = ratingQualityAdjustment(
      ratings(
        source('google', 4.8, 1200),
        source('yelp', 4.6, 600),
        source('tripadvisor', 4.7, 350),
      ),
    )
    expect(strong.points).toBeGreaterThanOrEqual(3)
    expect(strong.reason).toMatch(/Strong public ratings/)
  })

  it('shrinks tiny review samples toward the prior', () => {
    const tiny = ratingQualityAdjustment(
      ratings(
        source('google', 5, 2),
        source('yelp', null, null),
        source('tripadvisor', null, null),
      ),
    )
    const established = ratingQualityAdjustment(
      ratings(
        source('google', 5, 2000),
        source('yelp', null, null),
        source('tripadvisor', null, null),
      ),
    )
    expect(established.points).toBeGreaterThan(tiny.points)
  })

  it('returns no adjustment when no ratings are available', () => {
    expect(
      ratingQualityAdjustment(
        ratings(
          source('google', null, null),
          source('yelp', null, null),
          source('tripadvisor', null, null),
        ),
      ),
    ).toEqual({ points: 0 })
  })
})
