import { cuisineById } from '../data/cuisines'
import { googlePriceLevel, yelpPriceLevel } from './priceRange'
import { seedSourceRating } from './ratings'
import { cacheTtlUntilEndOfUtcDay, readCache, utcDayKey, writeCache } from './storage'
import type { CitySelection, CuisineId, Restaurant } from './types'

export type ProviderCandidate = {
  source: 'google' | 'yelp'
  id: string
  name: string
  lat: number
  lon: number
  address?: string
  website?: string
  phone?: string
  categories: string[]
  rating?: number | null
  reviewCount?: number | null
  price?: string | null
  priceLevel?: string | number | null
  url?: string | null
  matchedTerm: string
}

type ProviderDiscoveryResponse = {
  places?: ProviderCandidate[]
  sources?: { google?: boolean; yelp?: boolean }
  warnings?: string[]
  error?: string
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function haversineKm(a: Restaurant, b: { lat: number; lon: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function namesSimilar(a: string, b: string): boolean {
  const left = normalizeName(a)
  const right = normalizeName(b)
  if (!left || !right) return false
  if (left === right) return true
  if (left.length >= 6 && right.length >= 6 && (left.includes(right) || right.includes(left))) return true

  const leftTokens = left.split(' ').filter((token) => token.length > 2)
  const rightTokens = right.split(' ').filter((token) => token.length > 2)
  const overlap = leftTokens.filter((token) => rightTokens.includes(token))
  return overlap.length >= Math.min(2, leftTokens.length, rightTokens.length)
}

function normalizedCategories(candidate: ProviderCandidate): string[] {
  const matched = candidate.matchedTerm
    .toLowerCase()
    .replace(/\brestaurants?\b/g, '')
    .trim()
  const raw = [...candidate.categories, matched]
    .map((value) => value.toLowerCase().trim().replace(/\s+/g, '_'))
    .filter(Boolean)
  return Array.from(new Set(raw))
}

function seedCandidateRating(place: Restaurant, cityLabel: string, candidate: ProviderCandidate): void {
  if (candidate.source === 'google') {
    seedSourceRating(place, cityLabel, 'google', {
      rating: candidate.rating ?? null,
      reviewCount: candidate.reviewCount ?? null,
      ...(candidate.url ? { url: candidate.url } : {}),
      priceLevel: googlePriceLevel(candidate.priceLevel),
    })
  } else {
    seedSourceRating(place, cityLabel, 'yelp', {
      rating: candidate.rating ?? null,
      reviewCount: candidate.reviewCount ?? null,
      ...(candidate.url ? { url: candidate.url } : {}),
      priceLevel: yelpPriceLevel(candidate.price ?? null),
    })
  }
}

export function buildDiscoveryTerms(
  selectedCuisines: CuisineId[],
  keyword?: string,
): string[] {
  const terms: string[] = []
  const trimmedKeyword = keyword?.trim()
  if (trimmedKeyword) terms.push(trimmedKeyword)

  for (const id of selectedCuisines) {
    if (id === 'healthy') continue
    terms.push(cuisineById(id).label)
  }

  return terms
    .map((term) => term.trim())
    .filter(Boolean)
    .filter((term, index, all) => all.findIndex((other) => other.toLowerCase() === term.toLowerCase()) === index)
    .slice(0, 3)
}

export async function discoverProviderCandidates(
  city: CitySelection,
  selectedCuisines: CuisineId[],
  keyword?: string,
  signal?: AbortSignal,
): Promise<ProviderCandidate[]> {
  const terms = buildDiscoveryTerms(selectedCuisines, keyword)
  if (!terms.length) return []

  const cacheKey = [
    'providerDiscovery:v1',
    utcDayKey(),
    city.center.lat.toFixed(3),
    city.center.lon.toFixed(3),
    terms.map((term) => term.toLowerCase()).sort().join('|'),
  ].join(':')
  const cached = readCache<ProviderCandidate[]>(cacheKey)
  if (cached?.length) return cached

  const params = new URLSearchParams({
    lat: String(city.center.lat),
    lon: String(city.center.lon),
    city: city.label,
    terms: terms.join('|'),
  })
  const response = await fetch(`/api/discover?${params}`, {
    headers: { accept: 'application/json' },
    signal,
  })
  if (!response.ok) return []

  const data = (await response.json()) as ProviderDiscoveryResponse
  const places = data.places ?? []
  if (places.length) writeCache(cacheKey, places, cacheTtlUntilEndOfUtcDay())
  return places
}

export function mergeProviderCandidates(
  basePlaces: Restaurant[],
  candidates: ProviderCandidate[],
  cityLabel: string,
): Restaurant[] {
  const pool = basePlaces.map((place) => ({ ...place, cuisines: [...place.cuisines] }))

  for (const candidate of candidates) {
    const categories = normalizedCategories(candidate)
    const existing = pool.find(
      (place) =>
        namesSimilar(place.name, candidate.name) &&
        haversineKm(place, candidate) <= 0.65,
    )

    if (existing) {
      existing.cuisines = Array.from(new Set([...existing.cuisines, ...categories]))
      existing.discoveryTerms = Array.from(
        new Set([...(existing.discoveryTerms ?? []), candidate.matchedTerm].filter(Boolean)),
      )
      existing.cuisineRaw = Array.from(
        new Set([existing.cuisineRaw, ...candidate.categories].filter(Boolean)),
      ).join(', ')
      const candidateReviews = candidate.reviewCount ?? 0
      if (
        candidate.rating != null &&
        (existing.providerRating == null || candidateReviews >= (existing.providerReviewCount ?? 0))
      ) {
        existing.providerRating = candidate.rating
        existing.providerReviewCount = candidate.reviewCount ?? undefined
      }
      existing.address ||= candidate.address
      existing.website ||= candidate.website
      existing.phone ||= candidate.phone
      if (candidate.source === 'yelp') existing.yelpId ||= candidate.id
      seedCandidateRating(existing, cityLabel, candidate)
      continue
    }

    const place: Restaurant = {
      id: `${candidate.source}/${candidate.id}`,
      name: candidate.name,
      lat: candidate.lat,
      lon: candidate.lon,
      cuisines: categories,
      cuisineRaw: candidate.categories.filter(Boolean).join(', '),
      discoveryTerms: [candidate.matchedTerm],
      providerRating: candidate.rating ?? undefined,
      providerReviewCount: candidate.reviewCount ?? undefined,
      amenity: 'restaurant',
      address: candidate.address,
      website: candidate.website,
      phone: candidate.phone,
      yelpId: candidate.source === 'yelp' ? candidate.id : undefined,
    }
    seedCandidateRating(place, cityLabel, candidate)
    pool.push(place)
  }

  return pool
}
