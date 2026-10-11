import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { runHealthyHunt } from './healthySearch'
import { emptyTaste } from './taste'
import type { CitySelection, HealthyFocusId, Restaurant } from './types'

// Realistic mix around a city centre, tagged the way OSM / Google / Yelp tag them.
const C = { lat: 30.27, lon: -97.74 }
let n = 0
const p = (name: string, extra: Partial<Restaurant> = {}, km = 1): Restaurant => ({
  id: `node/${++n}`, name, lat: C.lat + km / 111, lon: C.lon, cuisines: [], amenity: 'restaurant', ...extra,
})
const POOL: Restaurant[] = [
  p('True Food Kitchen', { cuisines: ['american', 'healthy'], cuisineRaw: 'american;healthy' }, 3),
  p('Tropical Smoothie Cafe', { amenity: 'fast_food', cuisines: ['juice', 'sandwich'] }, 2),
  p('Pure Green', { amenity: 'shop' as never, cuisines: ['juice'] }, 4),
  p('Local Chophouse', { cuisines: ['steak_house'], cuisineRaw: 'steak_house' }, 2),
  p('Salt Water Seafood', { cuisines: ['seafood'] }, 3),
  p('Starbucks', { amenity: 'cafe', cuisines: ['coffee_shop'] }, 0.3),
  p("Dunkin'", { amenity: 'cafe', cuisines: ['coffee_shop', 'donut'] }, 0.4),
  p('Baskin-Robbins', { amenity: 'ice_cream', cuisines: ['ice_cream'] }, 0.5),
  p('Shipley Do-Nuts', { amenity: 'cafe', cuisines: ['donut'] }, 0.6),
  p('Krispy Kreme', { amenity: 'cafe', cuisines: ['donut', 'coffee_shop'] }, 0.7),
  p('Nothing Bundt Cakes', { amenity: 'cafe', cuisines: ['cake'] }, 0.5),
  p('Cheesecake Factory', { cuisines: ['american'] }, 1),
  p("Buffalo Joe's Bar & Grill", { cuisines: ['american', 'burger', 'wings'] }, 0.4),
  p('Pizza Palace', { cuisines: ['pizza'] }, 0.3),
  p('Chipotle Mexican Grill', { amenity: 'fast_food', cuisines: ['mexican'] }, 0.6),
  p('CAVA', { amenity: 'fast_food', cuisines: ['mediterranean'] }, 2),
  p('Sweetgreen', { amenity: 'fast_food', cuisines: ['salad'] }, 2.5),
  p('Sushi Zen', { cuisines: ['sushi', 'japanese'] }, 1.5),
  p('Olive Mediterranean Grill', { cuisines: ['mediterranean'] }, 1.2),
  p('Green Leaf Vegan Cafe', { amenity: 'cafe', cuisines: ['vegan', 'vegetarian'] }, 2),
  p('Juice Land', { amenity: 'fast_food', cuisines: ['juice'] }, 1.8),
  p('Smoothie King', { amenity: 'fast_food', cuisines: ['juice'] }, 1),
  p('Panera Bread', { amenity: 'fast_food', cuisines: ['sandwich', 'bakery'] }, 0.8),
  p('Texas BBQ Pit', { cuisines: ['bbq'] }, 0.9),
  p('Bella Italia', { cuisines: ['italian'] }, 0.7),
  p('Thai Orchid', { cuisines: ['thai'] }, 0.8),
  p('Poke Paradise', { cuisines: ['poke', 'hawaiian'] }, 1.4),
  p('Organic Harvest Kitchen', { cuisines: ['american', 'organic'], cuisineRaw: 'organic;farm_to_table' }, 3.5),
  p('Wingstop', { amenity: 'fast_food', cuisines: ['chicken', 'wings'] }, 0.5),
  p('Bubble Tea Station', { amenity: 'cafe', cuisines: ['bubble_tea'] }, 0.4),
]
const city: CitySelection = { label: 'Austin', center: C, bounds: { south: 30.2, west: -97.8, north: 30.35, east: -97.7 }, source: 'search' }

beforeAll(() => vi.stubGlobal('fetch', async () => new Response('{"places":[]}', { status: 200 })))
afterAll(() => vi.unstubAllGlobals())

const hunt = (osmPlaces: Restaurant[], label: string, focus: HealthyFocusId[] = []) =>
  runHealthyHunt({ city: { ...city, label }, selectedCuisines: ['healthy'], dietary: [], taste: emptyTaste(), osmPlaces, focus })
const names = (rows: Array<{ name: string }>) => rows.map((r) => r.name)

const NOT_HEALTHY = [
  'Starbucks', "Dunkin'", 'Baskin-Robbins', 'Shipley Do-Nuts', 'Krispy Kreme', 'Nothing Bundt Cakes',
  'Bubble Tea Station', 'Pizza Palace', "Buffalo Joe's Bar & Grill", 'Texas BBQ Pit', 'Cheesecake Factory',
  'Bella Italia', 'Thai Orchid', 'Wingstop',
]

describe('healthy search on a realistic neighborhood', () => {
  it('leads with the brands and whole-food spots people mean by healthy', async () => {
    const { displayed } = await hunt(POOL, 'Realistic')
    const top = names(displayed)
    expect(top.slice(0, 6)).toEqual(expect.arrayContaining(['True Food Kitchen', 'Tropical Smoothie Cafe', 'Pure Green']))
    expect(top).toEqual(expect.arrayContaining(['Local Chophouse', 'Poke Paradise', 'Green Leaf Vegan Cafe']))
    for (const name of NOT_HEALTHY) expect(top).not.toContain(name)
  })

  it('shows fewer places instead of padding with pizza, bars, desserts or coffee', async () => {
    const drop = new Set(['True Food Kitchen', 'Tropical Smoothie Cafe', 'Pure Green', 'CAVA', 'Sweetgreen', 'Smoothie King', 'Organic Harvest Kitchen', 'Local Chophouse', 'Salt Water Seafood', 'Juice Land'])
    const sparse = POOL.filter((r) => !drop.has(r.name)).map((r) => ({ ...r, id: `${r.id}-sparse` }))
    const { displayed } = await hunt(sparse, 'Sparse')
    expect(names(displayed).sort()).toEqual(['Green Leaf Vegan Cafe', 'Olive Mediterranean Grill', 'Poke Paradise', 'Sushi Zen'])
  })

  it('narrows to the chosen kind of healthy', async () => {
    expect(names((await hunt(POOL, 'Steak', ['steak'])).displayed)).toEqual(['Local Chophouse'])
    const smoothies = names((await hunt(POOL, 'Smoothies', ['smoothie'])).displayed)
    expect(smoothies).toEqual(expect.arrayContaining(['Tropical Smoothie Cafe', 'Pure Green', 'Smoothie King', 'Juice Land']))
    expect(smoothies).not.toContain('Local Chophouse')
    const seafoodOrPlant = names((await hunt(POOL, 'Mix', ['seafood', 'plant'])).displayed)
    expect(seafoodOrPlant).toEqual(expect.arrayContaining(['Poke Paradise', 'Sushi Zen', 'Green Leaf Vegan Cafe']))
    expect(seafoodOrPlant).not.toContain('Tropical Smoothie Cafe')
  })

  it('explains each pick with a specific reason', async () => {
    const { displayed } = await hunt(POOL, 'Reasons')
    const reasonFor = (name: string) => displayed.find((r) => r.name === name)?.reasons[0]
    expect(reasonFor('True Food Kitchen')).toMatch(/Known clean-food restaurant/)
    expect(reasonFor('Local Chophouse')).toMatch(/Steakhouse/)
    expect(reasonFor('Poke Paradise')).toMatch(/seafood|poke/i)
    for (const row of displayed) expect(row.reasons[0]).not.toMatch(/fallback/i)
  })
})
