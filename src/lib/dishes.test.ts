import { describe, expect, it } from 'vitest'
import { signatureDishes } from './dishes'
import type { Restaurant } from './types'

const place = (name: string, cuisines: string[], extra: Partial<Restaurant> = {}): Restaurant => ({
  id: name, name, lat: 0, lon: 0, cuisines, ...extra,
})

describe('signatureDishes', () => {
  it("uses each place's own category in healthy mode, not one list for everyone", () => {
    const smoothie = signatureDishes(place('Tropical Smoothie Cafe', ['juice', 'sandwich']), ['healthy'])
    const steak = signatureDishes(place('Local Chophouse', ['steak_house']), ['healthy'])
    const poke = signatureDishes(place('Poke Paradise', ['poke', 'hawaiian']), ['healthy'])
    expect(smoothie).toContain('Açaí bowl')
    expect(steak).toContain('Ribeye')
    expect(poke).toContain('Poke bowl')
    expect(new Set([smoothie.join(), steak.join(), poke.join()]).size).toBe(3)
  })

  it('falls back to name hints, then to the selected cuisine', () => {
    expect(signatureDishes(place('Pure Green', []), ['healthy'])).toContain('Green smoothie')
    expect(signatureDishes(place('Mystery Kitchen', []), ['tacos']).length).toBeGreaterThan(0)
  })

  it('still prefers the cuisine the user picked when the place matches it', () => {
    expect(signatureDishes(place('Sushi Zen', ['sushi', 'japanese']), ['sushi'])[0]).toBe('Salmon roll')
  })
})

describe('signatureDishes for healthy brands', () => {
  it('gives True Food Kitchen healthy dishes even though OSM tags it american', () => {
    const dishes = signatureDishes(place('True Food Kitchen', ['american', 'healthy']), ['healthy'])
    expect(dishes).not.toContain('Cheeseburger')
    expect(dishes).toContain('Grilled salmon')
  })
})
