import { describe, expect, it } from 'vitest'
import { findLunchSpecial, lunchServiceHours, lunchVerdict } from './lunch'

const place = (extra: { openingHours?: string; evidenceText?: string } = {}) => ({
  id: 'p', name: 'Green Bowl', lat: 0, lon: 0, cuisines: [], ...extra,
})

describe('findLunchSpecial', () => {
  it('finds common ways people mention lunch deals', () => {
    for (const text of [
      'Their lunch special is a bowl and a drink for $11.',
      'Great weekday lunch deals, fast service.',
      'The $12 lunch plate is huge.',
      'Lunch combos come with soup.',
      'Lunch is only $10 before 2pm.',
      'They do a lunch menu from 11 to 3.',
    ]) {
      expect(findLunchSpecial(text), text).not.toBeNull()
    }
  })

  it('quotes the sentence it found', () => {
    expect(findLunchSpecial('Nice patio. Their lunch special is a bowl and a drink for $11. Parking is tight.'))
      .toBe('Their lunch special is a bowl and a drink for $11.')
  })

  it('ignores negated or unrelated mentions', () => {
    expect(findLunchSpecial('They no longer have a lunch special.')).toBeNull()
    expect(findLunchSpecial('We came for lunch and loved it.')).toBeNull()
    expect(findLunchSpecial('')).toBeNull()
  })
})

describe('lunchServiceHours', () => {
  it('reads OSM opening_hours', () => {
    expect(lunchServiceHours('Mo-Fr 11:00-15:00; Sa 10:00-14:00')).toEqual({ serves: true, hours: '11:00–15:00' })
    expect(lunchServiceHours('Mo-Su 17:00-22:00')).toEqual({ serves: false, hours: null })
    expect(lunchServiceHours('Tu-Su 11:30-22:00')).toEqual({ serves: true, hours: '11:30–22:00' })
    expect(lunchServiceHours('by appointment')).toBeNull()
    expect(lunchServiceHours(undefined)).toBeNull()
  })
})

describe('lunchVerdict', () => {
  it('verifies from review text, rules out dinner-only, otherwise unknown', () => {
    expect(lunchVerdict(place({ evidenceText: 'Weekday lunch specials are a steal.' })).status).toBe('special')
    expect(lunchVerdict(place({ openingHours: 'Mo-Su 17:00-22:00', evidenceText: 'lunch special' })).status).toBe('no_lunch')
    expect(lunchVerdict(place({ openingHours: 'Mo-Fr 11:00-21:00' }))).toEqual({ status: 'unknown', evidence: null, lunchHours: '11:00–21:00' })
  })
})
