import { describe, expect, it } from 'vitest'
import { cuisineById } from '../data/cuisines'
import { describeParsedQuery, parseSearchQuery, withoutPlaceGuess } from './queryParser'

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

describe('parseSearchQuery lunch', () => {
  it('understands the healthy + no seed oils + lunch special request', () => {
    const q = parseSearchQuery('Healthy food no seed oils with a lunch special')
    expect(q).toMatchObject({ healthy: true, dietary: ['no_seed_oils'], lunchSpecial: true, lunch: true, keyword: '', cuisines: [] })
    expect(describeParsedQuery(q, (id) => cuisineById(id).label)).toEqual(['Healthy & clean', 'no seed oils', 'lunch special'])
  })

  it('treats deals and combos as specials, and plain lunch as lunch hours only', () => {
    expect(parseSearchQuery('thai lunch deals near Irving').lunchSpecial).toBe(true)
    expect(parseSearchQuery('sushi lunch combo in Plano').lunchSpecial).toBe(true)
    const plain = parseSearchQuery('healthy lunch near me')
    expect(plain).toMatchObject({ lunch: true, lunchSpecial: false, nearMe: true })
  })

  it('allows a lunch-special search with no food named', () => {
    const q = parseSearchQuery('lunch specials near Coppell TX')
    expect(q).toMatchObject({ lunchSpecial: true, location: 'coppell tx', keyword: '', cuisines: [] })
  })

  it('reads the city with or without "in" / "near"', () => {
    for (const q of ['healthy food in Coppell TX', 'healthy food in coppell, tx', 'Healthy food Coppell TX', 'healthy food Coppell, TX']) {
      const parsed = parseSearchQuery(q)
      expect(parsed, q).toMatchObject({ healthy: true, location: 'coppell tx', keyword: '', cuisines: [] })
    }
    expect(parseSearchQuery('healthy salmon Frisco Texas')).toMatchObject({ healthy: true, location: 'frisco texas', healthyFocus: ['seafood'] })
    expect(parseSearchQuery('mexican restaurant new york ny')).toMatchObject({ cuisines: ['mexican'], location: 'new york ny' })
    expect(parseSearchQuery('tacos al pastor')).toMatchObject({ location: null })
    expect(parseSearchQuery('chicken strips in Coppell TX')).toMatchObject({ keyword: 'chicken strips', cuisines: [], location: 'coppell tx' })
    expect(parseSearchQuery('steak or salmon')).toMatchObject({ location: null })
    expect(parseSearchQuery('pizza Portland OR')).toMatchObject({ location: 'portland or' })
    expect(parseSearchQuery('healthy food near me')).toMatchObject({ location: null, nearMe: true })
  })

  it('reads "fast" as quick and "no smoothies" as an exclusion', () => {
    expect(parseSearchQuery('Healthy fast lunch near me')).toMatchObject({
      healthy: true, quick: true, lunch: true, lunchSpecial: false, nearMe: true, location: null, keyword: '', healthyAvoid: [],
    })
    const noSmoothies = parseSearchQuery('healthy restaurants  near me no smoothies')
    expect(noSmoothies).toMatchObject({ healthy: true, nearMe: true, healthyAvoid: ['smoothie'], healthyFocus: [], quick: false, keyword: '' })
    expect(parseSearchQuery('healthy food without smoothies or juice bars')).toMatchObject({ healthyAvoid: ['smoothie'], healthyFocus: [] })
    expect(parseSearchQuery('healthy salmon, no steakhouses')).toMatchObject({ healthyAvoid: ['steak'], healthyFocus: ['seafood'] })
    expect(parseSearchQuery('healthy smoothies near Frisco')).toMatchObject({ healthyAvoid: [], healthyFocus: ['smoothie'] })
    expect(parseSearchQuery('healthy breakfast')).toMatchObject({ quick: false })
    expect(describeParsedQuery(noSmoothies, (id) => id)).toEqual(['Healthy & clean', 'near you', 'no smoothies'])
  })

  it('keeps a healthy brand whole and runs the healthy hunt for it', () => {
    expect(parseSearchQuery('true food kitchen')).toMatchObject({ healthy: true, brand: 'True Food Kitchen', keyword: 'True Food Kitchen', location: null })
    expect(parseSearchQuery('True Food Kitchen near Southlake')).toMatchObject({ brand: 'True Food Kitchen', location: 'southlake' })
    expect(parseSearchQuery('tropical smoothie frisco')).toMatchObject({
      brand: 'Tropical Smoothie Cafe', healthyFocus: ['smoothie'], placeGuess: 'frisco',
    })
  })

  it('treats smoothies, salmon, grass-fed and no seed oils as the healthy hunt', () => {
    expect(parseSearchQuery('smoothies near me')).toMatchObject({ healthy: true, healthyFocus: ['smoothie'], nearMe: true, cuisines: [] })
    expect(parseSearchQuery('salmon')).toMatchObject({ healthy: true, healthyFocus: ['seafood'], cuisines: [] })
    expect(parseSearchQuery('grass fed steak Frisco TX')).toMatchObject({ healthy: true, healthyFocus: ['steak'], dietary: ['grass_fed'], location: 'frisco tx' })
    expect(parseSearchQuery('no seed oil restaurants')).toMatchObject({ healthy: true, dietary: ['no_seed_oils'] })
    // A regular cuisine stays that cuisine, with the requirement as a filter.
    expect(parseSearchQuery('Mexican near Coppell TX without seed oils')).toMatchObject({ healthy: false, cuisines: ['mexican'], dietary: ['no_seed_oils'] })
    // Plain "steak" is a steak search; grass-fed makes it healthy.
    expect(parseSearchQuery('steak')).toMatchObject({ healthy: false, cuisines: ['steak'] })
  })

  it('guesses a town typed without "in" or "near", and gives it back when it is not one', () => {
    expect(parseSearchQuery('healthy food Coppell')).toMatchObject({ healthy: true, location: null, placeGuess: 'coppell' })
    expect(parseSearchQuery('acai bowl plano')).toMatchObject({ healthy: true, healthyFocus: ['smoothie'], placeGuess: 'plano' })
    expect(parseSearchQuery('Coppell')).toMatchObject({ placeGuess: 'coppell', keyword: '' })
    expect(parseSearchQuery('healthy food in Coppell')).toMatchObject({ location: 'coppell', placeGuess: null })
    expect(parseSearchQuery('smoothies near me')).toMatchObject({ placeGuess: null })
    const birria = parseSearchQuery('birria')
    expect(birria.placeGuess).toBe('birria')
    expect(withoutPlaceGuess(birria)).toMatchObject({ keyword: 'birria', placeGuess: null })
  })

  it('names the kind of healthy in the confirmation line', () => {
    expect(describeParsedQuery(parseSearchQuery('healthy salmon near Coppell TX'), (id) => id)).toEqual(['Healthy & clean', 'salmon & seafood', 'near Coppell TX'])
    expect(describeParsedQuery(parseSearchQuery('true food kitchen'), (id) => id)).toEqual(['Healthy & clean', '“True Food Kitchen”'])
  })
})
