import { describe, expect, it } from 'vitest'
import { extractHealthySignals } from './healthySignals'
import type { SeedOilInfo } from './seedOil'
import { applyRequirements, applySeedOilRequirement, seedOilVerdict } from './seedOilStatus'
import type { Restaurant } from './types'

const place = (id: string, extra: Partial<Restaurant & { signals: ReturnType<typeof extractHealthySignals>; evidenceText: string }> = {}) => ({
  id, name: id, lat: 0, lon: 0, cuisines: ['mexican'], ...extra,
})
const grade = (g: string): SeedOilInfo => ({ grade: g, risk: null, cookingOil: null, chain: null, url: 'https://seedoiltracker.com' })

describe('seedOilVerdict', () => {
  it('trusts Seed Oil Tracker grades both ways', () => {
    expect(seedOilVerdict(place('a'), grade('A')).status).toBe('free')
    expect(seedOilVerdict(place('f'), grade('F'))).toEqual({ status: 'uses', evidence: 'Seed Oil Tracker grade F' })
  })

  it('counts lard, tallow, avocado oil and "no seed oils" in reviews as seed-oil free', () => {
    const lard = place('lard', { signals: extractHealthySignals('Tortillas and beans made with lard, like abuela', 'yelp_review') })
    expect(seedOilVerdict(lard, null)).toEqual({ status: 'free', evidence: 'Yelp review: cooks with tallow or lard' })
    const avocado = place('avo', { signals: extractHealthySignals('They cook everything in avocado oil', 'google_snippet') })
    expect(seedOilVerdict(avocado, null).status).toBe('free')
  })

  it('does not count "no lard" as evidence', () => {
    const noLard = place('nolard', { signals: extractHealthySignals('Beans are made without lard', 'yelp_review') })
    expect(seedOilVerdict(noLard, null).status).toBe('unknown')
  })

  it('flags reviews that say it fries in seed oil, and leaves silence as unknown', () => {
    expect(seedOilVerdict(place('canola', { evidenceText: 'Chips are fried in canola oil daily.' }), null).status).toBe('uses')
    expect(seedOilVerdict(place('quiet'), null)).toEqual({ status: 'unknown', evidence: null })
  })
})

describe('applySeedOilRequirement', () => {
  it('drops places that use seed oils and lists verified ones first', () => {
    const places = [
      place('unknown-1'),
      place('graded-f'),
      place('lard', { signals: extractHealthySignals('cooked in lard', 'yelp_review') }),
      place('unknown-2'),
      place('graded-a'),
    ]
    const result = applySeedOilRequirement(places, { 'graded-f': grade('F'), 'graded-a': grade('A') })
    expect(result.map((p) => p.id)).toEqual(['lard', 'graded-a', 'unknown-1', 'unknown-2'])
  })
})

describe('applyRequirements', () => {
  it('combines no seed oils and lunch special: hides failures, best-verified first', () => {
    const places = [
      place('nothing-known'),
      place('lunch-only', { evidenceText: 'Weekday lunch specials are great.' }),
      place('both', { evidenceText: 'Lunch special bowls, and they cook with avocado oil.', signals: extractHealthySignals('cook with avocado oil', 'yelp_review') }),
      place('dinner-only', { openingHours: 'Mo-Su 17:00-22:00' }),
      place('fryer', { evidenceText: 'Everything is fried in canola oil.' }),
    ]
    const result = applyRequirements(places, { noSeedOils: true, lunchSpecial: true }, {})
    expect(result.map((p) => p.id)).toEqual(['both', 'lunch-only', 'nothing-known'])
  })

  it('is a no-op with no requirements', () => {
    const places = [place('a'), place('b')]
    expect(applyRequirements(places, { noSeedOils: false, lunchSpecial: false }, {})).toBe(places)
  })
})
