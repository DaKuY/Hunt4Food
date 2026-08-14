import { cuisineById } from '../data/cuisines'
import { readCache, writeCache } from './storage'
import type { CuisineId, MapBounds, Restaurant } from './types'

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
]

const CACHE_TTL_MS = 1000 * 60 * 60 * 12 // 12 hours

type OverpassElement = {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function buildQuery(bounds: MapBounds, cuisines: CuisineId[]): string {
  const { south, west, north, east } = bounds
  const bbox = `${south},${west},${north},${east}`
  const tags = Array.from(
    new Set(cuisines.flatMap((id) => cuisineById(id).osmTags)),
  )

  const cuisineRegex = tags.map(escapeRegex).join('|')
  // Also catch smoothie/healthy via amenity/cuisine loosely
  const amenityFilter = '["amenity"~"^(restaurant|cafe|fast_food|ice_cream|food_court)$"]'

  const cuisineClause =
    cuisineRegex.length > 0
      ? `["cuisine"~"${cuisineRegex}",i]`
      : ''

  // Broader name/cuisine keyword match for smoothie & healthy
  const keywordBits = cuisines.flatMap((id) => cuisineById(id).keywords)
  const nameRegex = Array.from(new Set(keywordBits)).map(escapeRegex).join('|')

  return `
[out:json][timeout:18];
(
  nwr${amenityFilter}${cuisineClause}(${bbox});
  nwr${amenityFilter}["name"~"${nameRegex}",i](${bbox});
  nwr["cuisine"~"${cuisineRegex}",i](${bbox});
);
out center tags;
`.trim()
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function elementToRestaurant(el: OverpassElement): Restaurant | null {
  const tags = el.tags ?? {}
  const name = tags.name || tags['name:en']
  if (!name) return null
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (lat == null || lon == null) return null

  const cuisineRaw = tags.cuisine ?? ''
  const cuisines = cuisineRaw
    .split(/[;,]/)
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)

  const address = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
    .filter(Boolean)
    .join(' ')

  return {
    id: `${el.type}/${el.id}`,
    name,
    lat,
    lon,
    cuisines,
    cuisineRaw,
    address: address || tags['addr:full'] || undefined,
    phone: tags.phone || tags['contact:phone'],
    website: tags.website || tags['contact:website'] || tags['contact:facebook'],
    openingHours: tags.opening_hours,
    vegetarian: tags.vegetarian || tags.diet_vegetarian,
    vegan: tags.vegan || tags.diet_vegan,
    glutenFree: tags.gluten_free || tags['diet:gluten_free'],
    halal: tags.halal || tags.diet_halal,
    amenity: tags.amenity,
  }
}

function dedupe(places: Restaurant[]): Restaurant[] {
  const seen = new Map<string, Restaurant>()
  for (const p of places) {
    const key = `${p.name.toLowerCase().replace(/\s+/g, ' ')}|${p.lat.toFixed(3)}|${p.lon.toFixed(3)}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, p)
      continue
    }
    // Prefer richer tags
    const score = (r: Restaurant) =>
      [r.website, r.phone, r.address, r.openingHours, r.cuisineRaw].filter(Boolean).length
    if (score(p) > score(existing)) seen.set(key, p)
  }
  return Array.from(seen.values())
}

function cacheKey(bounds: MapBounds, cuisines: CuisineId[]): string {
  const b = [bounds.south, bounds.west, bounds.north, bounds.east]
    .map((n) => n.toFixed(3))
    .join(',')
  return `overpass:v2:${b}:${[...cuisines].sort().join('+')}`
}

async function fetchMirror(
  mirror: string,
  query: string,
  signal?: AbortSignal,
): Promise<Restaurant[]> {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(mirror, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Overpass ${res.status} @ ${mirror}`)
    const data = (await res.json()) as { elements?: OverpassElement[] }
    const places = (data.elements ?? [])
      .map(elementToRestaurant)
      .filter((p): p is Restaurant => p != null)
    return dedupe(places)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function fetchRestaurants(
  bounds: MapBounds,
  cuisines: CuisineId[],
  signal?: AbortSignal,
): Promise<Restaurant[]> {
  const key = cacheKey(bounds, cuisines)
  const cached = readCache<Restaurant[]>(key)
  if (cached) return cached

  const query = buildQuery(bounds, cuisines)
  const raceCtrl = new AbortController()
  const onAbort = () => raceCtrl.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const places = await new Promise<Restaurant[]>((resolve, reject) => {
      let pending = MIRRORS.length
      let settled = false
      for (const mirror of MIRRORS) {
        void fetchMirror(mirror, query, raceCtrl.signal)
          .then((result) => {
            if (settled) return
            settled = true
            raceCtrl.abort()
            resolve(result)
          })
          .catch((err) => {
            pending -= 1
            if (pending === 0 && !settled) {
              reject(err instanceof Error ? err : new Error('All Overpass mirrors failed'))
            }
          })
      }
    })
    writeCache(key, places, CACHE_TTL_MS)
    return places
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}
