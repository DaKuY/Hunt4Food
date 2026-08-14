import { cuisineById } from '../data/cuisines'
import { jsonpGet, ratingsProxyUrl } from './ratingsProxy'
import { cacheTtlUntilEndOfUtcDay, readCache, utcDayKey, writeCache } from './storage'
import type { CuisineId, Restaurant } from './types'

const CACHE_VERSION = 'v3'

function cacheKey(place: Restaurant, cityLabel: string): string {
  return `dishes:${CACHE_VERSION}:${utcDayKey()}:${place.id}:${cityLabel.slice(0, 40)}`
}

/** Best-effort signature dishes from OSM cuisine tags + selected cuisines. */
export function signatureDishes(place: Restaurant, selectedCuisines: CuisineId[]): string[] {
  const out: string[] = []
  const blob = `${place.cuisines.join(' ')} ${place.cuisineRaw ?? ''} ${place.name}`.toLowerCase()

  for (const id of selectedCuisines) {
    for (const dish of cuisineById(id).signatureDishes) {
      if (!out.includes(dish)) out.push(dish)
    }
  }

  for (const c of place.cuisines) {
    const match = selectedCuisines.find((id) => {
      const opt = cuisineById(id)
      return opt.osmTags.some((t) => t === c || c.includes(t))
    })
    if (match) {
      for (const dish of cuisineById(match).signatureDishes) {
        if (!out.includes(dish)) out.push(dish)
      }
    }
  }

  if (out.length < 3) {
    for (const id of selectedCuisines) {
      if (out.length >= 3) break
      for (const dish of cuisineById(id).signatureDishes) {
        if (!out.includes(dish)) out.push(dish)
      }
    }
  }

  if (out.length === 0 && /pizza/i.test(blob)) out.push('Margherita pizza', 'Pepperoni pizza', 'Garlic knots')
  if (out.length === 0 && /sushi|japanese/i.test(blob)) out.push('Salmon roll', 'Spicy tuna roll', 'Miso soup')
  if (out.length === 0 && /burger|american/i.test(blob)) out.push('Cheeseburger', 'Fries', 'Milkshake')

  return out.slice(0, 3)
}

async function fetchYelpDishes(
  place: Restaurant,
  cityLabel: string,
): Promise<string[]> {
  const proxy = ratingsProxyUrl()
  if (!proxy) return []
  const data = await jsonpGet<{ dishes?: string[]; error?: string }>(proxy, {
    source: 'yelp',
    name: place.name,
    city: cityLabel,
    lat: String(place.lat),
    lon: String(place.lon),
    dishes: '1',
  })
  return (data.dishes ?? []).filter(Boolean).slice(0, 3)
}

export async function fetchPopularDishes(
  place: Restaurant,
  cityLabel: string,
  selectedCuisines: CuisineId[],
  signal?: AbortSignal,
): Promise<string[]> {
  const ck = cacheKey(place, cityLabel)
  const cached = readCache<string[]>(ck)
  if (cached?.length) return cached

  const fallback = signatureDishes(place, selectedCuisines)
  if (signal?.aborted) return fallback

  let result = fallback
  try {
    const fromYelp = await fetchYelpDishes(place, cityLabel)
    const merged = [...fromYelp]
    for (const d of fallback) {
      if (merged.length >= 3) break
      if (!merged.some((x) => x.toLowerCase() === d.toLowerCase())) merged.push(d)
    }
    result = merged.slice(0, 3)
  } catch {
    result = fallback
  }

  writeCache(ck, result, cacheTtlUntilEndOfUtcDay())
  return result
}
