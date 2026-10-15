import { describe, expect, it } from 'vitest'
import { cuisineById } from '../data/cuisines'
import { describeParsedQuery, parseSearchQuery } from './queryParser'

describe('parseSearchQuery', () => {
  it('understands the example request', () => {
    const q = parseSearchQuery("Find me a Mexican restaurant near coppell tx that doesn't have seed oils")
    expect(q.cuisines).toEqual(['mexican'])
    expect(q.location).toBe('coppell tx')
    expect(q.dietary).toEqual(['no_seed_oils'])
    expect(q.healthy).toBe(false)
    expect(q.keyword).toBe('')
  })

  it('handles commas, other negations and seed-oil-free wording', () => {
    expect(parseSearchQuery('mexican food in Coppell, TX without seed oils').location).toBe('coppell tx')
    expect(parseSearchQuery('seed oil free tacos near Plano').dietary).toContain('no_seed_oils')
    expect(parseSearchQuery('sushi in Dallas that does not use canola').dietary).toContain('no_seed_oils')
  })

  it('reads healthy requests as healthy mode with a focus', () => {
    const q = parseSearchQuery('healthy steak or salmon near Frisco')
    expect(q.healthy).toBe(true)
    expect(q.healthyFocus).toEqual(expect.arrayContaining(['steak', 'seafood']))
    expect(q.cuisines).toEqual([])
    expect(q.location).toBe('frisco')
  })

  it('picks up distance, price, open now and dietary needs', () => {
    const q = parseSearchQuery('cheap gluten free italian within 4 miles open now')
    expect(q.cuisines).toEqual(['italian'])
    expect(q.dietary).toEqual(['gluten_free'])
    expect(q.maxMiles).toBe(5)
    expect(q.priceLevels).toEqual([1, 2])
    expect(q.openNow).toBe(true)
  })

  it('treats "near me" as the current area', () => {
    const q = parseSearchQuery('grass fed burger near me')
    expect(q.nearMe).toBe(true)
    expect(q.location).toBeNull()
    expect(q.cuisines).toEqual(['burger'])
    expect(q.dietary).toEqual(['grass_fed'])
  })

  it('does not read a street name as the food', () => {
    const q = parseSearchQuery('pizza near Salmon St')
    expect(q.cuisines).toEqual(['pizza'])
    expect(q.location).toBe('salmon st')
  })

  it('falls back to a keyword for dishes it has no category for', () => {
    expect(parseSearchQuery('birria near Irving').keyword).toBe('birria')
  })

  it('summarizes what it understood', () => {
    const q = parseSearchQuery("Find me a Mexican restaurant near coppell tx that doesn't have seed oils")
    expect(describeParsedQuery(q, (id) => cuisineById(id).label)).toEqual(['Mexican', 'near Coppell TX', 'no seed oils'])
  })
})

describe('parseSearchQuery keyword cuisines', () => {
  it('maps a dish word to its cuisine when no cuisine is named', () => {
    expect(parseSearchQuery('best taqueria in Lewisville').cuisines).toEqual(['tacos'])
  })
})
