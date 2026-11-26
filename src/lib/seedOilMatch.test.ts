import { describe, expect, it } from 'vitest'
import { chainMatchesName } from './seedOil'

describe('Seed Oil Tracker chain matching', () => {
  it('keeps a grade only for the same chain', () => {
    expect(chainMatchesName('Chick-fil-A', 'Chick-fil-A #1234')).toBe(true)
    expect(chainMatchesName('Tropical Smoothie Cafe', 'Tropical Smoothie Cafe - Lamar')).toBe(true)
    expect(chainMatchesName('Chipotle', 'Chipotle Mexican Grill')).toBe(true)
    expect(chainMatchesName('Cheesecake Factory', 'The Cheesecake Factory')).toBe(true)
    expect(chainMatchesName("McDonald's", 'McDonalds')).toBe(true)
    expect(chainMatchesName('Kura Sushi', 'Kura Revolving Sushi Bar')).toBe(true)
  })

  it('rejects fuzzy matches to a different restaurant', () => {
    expect(chainMatchesName('Kura Sushi', 'Sushi Sakana')).toBe(false)
    expect(chainMatchesName('Panda Express', 'Panda Garden')).toBe(false)
    expect(chainMatchesName('True Food Kitchen', 'Food Kitchen')).toBe(false)
    expect(chainMatchesName('Taco Bell', 'Velvet Taco')).toBe(false)
  })
})
