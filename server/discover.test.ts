import { describe, expect, it } from 'vitest'
import { searchPhrase } from '../api/discover'

describe('searchPhrase', () => {
  it('searches brands and venue words as typed', () => {
    expect(searchPhrase('Pure Green')).toBe('Pure Green')
    expect(searchPhrase('True Food Kitchen')).toBe('True Food Kitchen')
    expect(searchPhrase('juice bar')).toBe('juice bar')
    expect(searchPhrase('smoothie bowl')).toBe('smoothie bowl')
    expect(searchPhrase('grass fed steakhouse')).toBe('grass fed steakhouse')
  })

  it('adds "restaurant" to plain foods', () => {
    expect(searchPhrase('wild salmon')).toBe('wild salmon restaurant')
    expect(searchPhrase('grass fed')).toBe('grass fed restaurant')
  })
})
