import { googleMapsUrl, tripadvisorUrl, yelpUrl } from './links'
import { consumeGoogleQuota, getGoogleQuota, googleQuotaMessage } from './googleQuota'
import { jsonpGet, ratingsProxyUrl } from './ratingsProxy'
import { readCache, writeCache } from './storage'
import { loadSettings } from './settings'
import type { Restaurant } from './types'

export { getGoogleQuota, googleQuotaMessage } from './googleQuota'

export type SourceRating = {
  source: 'google' | 'yelp' | 'tripadvisor'
  rating: number | null
  reviewCount: number | null
  url: string
  loading?: boolean
  error?: string
}

export type PlaceRatings = {
  google: SourceRating
  yelp: SourceRating
  tripadvisor: SourceRating
}

const CACHE_TTL = 1000 * 60 * 60 * 24 * 7 // 7 days

function cacheKey(place: Restaurant, cityLabel: string, source: string): string {
  return `rating:${source}:${place.id}:${cityLabel.slice(0, 40)}`
}

function emptyRatings(place: Restaurant, cityLabel: string): PlaceRatings {
  return {
    google: { source: 'google', rating: null, reviewCount: null, url: googleMapsUrl(place, cityLabel) },
    yelp: { source: 'yelp', rating: null, reviewCount: null, url: yelpUrl(place, cityLabel) },
    tripadvisor: {
      source: 'tripadvisor',
      rating: null,
      reviewCount: null,
      url: tripadvisorUrl(place, cityLabel),
    },
  }
}

async function fetchGooglePlacesRating(
  place: Restaurant,
  cityLabel: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<Pick<SourceRating, 'rating' | 'reviewCount' | 'url'>> {
  const body = {
    textQuery: `${place.name} ${cityLabel}`.trim(),
    locationBias: {
      circle: {
        center: { latitude: place.lat, longitude: place.lon },
        radius: 800,
      },
    },
    maxResultCount: 1,
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.googleMapsUri',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Google Places ${res.status}`)
  const data = (await res.json()) as {
    places?: Array<{
      displayName?: { text?: string }
      rating?: number
      userRatingCount?: number
      googleMapsUri?: string
    }>
  }

  const hit = data.places?.[0]
  return {
    rating: hit?.rating ?? null,
    reviewCount: hit?.userRatingCount ?? null,
    url: hit?.googleMapsUri ?? googleMapsUrl(place, cityLabel),
  }
}

/** Fetch Yelp / TripAdvisor via Google Apps Script proxy (browser scraping is blocked). */
async function fetchProxyRating(
  source: 'yelp' | 'tripadvisor',
  place: Restaurant,
  cityLabel: string,
): Promise<Pick<SourceRating, 'rating' | 'reviewCount' | 'url'>> {
  const proxy = ratingsProxyUrl()
  const fallbackUrl = source === 'yelp' ? yelpUrl(place, cityLabel) : tripadvisorUrl(place, cityLabel)
  if (!proxy) {
    throw new Error('Ratings proxy not configured')
  }
  const data = await jsonpGet<{ rating?: number | null; reviewCount?: number | null; url?: string; error?: string }>(
    proxy,
    {
      source,
      name: place.name,
      city: cityLabel,
      lat: String(place.lat),
      lon: String(place.lon),
    },
  )
  if (data.error && data.rating == null) throw new Error(data.error)
  return {
    rating: data.rating ?? null,
    reviewCount: data.reviewCount ?? null,
    url: data.url || fallbackUrl,
  }
}

async function fetchYelpRating(
  place: Restaurant,
  cityLabel: string,
  _signal?: AbortSignal,
): Promise<Pick<SourceRating, 'rating' | 'reviewCount' | 'url'>> {
  return fetchProxyRating('yelp', place, cityLabel)
}

async function fetchTripAdvisorRating(
  place: Restaurant,
  cityLabel: string,
  _signal?: AbortSignal,
): Promise<Pick<SourceRating, 'rating' | 'reviewCount' | 'url'>> {
  return fetchProxyRating('tripadvisor', place, cityLabel)
}

export async function fetchPlaceRatings(
  place: Restaurant,
  cityLabel: string,
  signal?: AbortSignal,
): Promise<PlaceRatings> {
  const base = emptyRatings(place, cityLabel)
  const settings = loadSettings()

  const cached = readCache<PlaceRatings>(cacheKey(place, cityLabel, 'all'))
  if (cached) return cached

  const [google, yelp, tripadvisor] = await Promise.all([
    (async () => {
      const ck = cacheKey(place, cityLabel, 'google')
      const hit = readCache<SourceRating>(ck)
      if (hit) return hit
      if (!settings.googlePlacesApiKey) {
        return { ...base.google, error: 'Google Places key not configured' }
      }
      if (!getGoogleQuota().canRequest) {
        return { ...base.google, error: googleQuotaMessage() }
      }
      if (!consumeGoogleQuota()) {
        return { ...base.google, error: googleQuotaMessage() }
      }
      try {
        const data = await fetchGooglePlacesRating(place, cityLabel, settings.googlePlacesApiKey, signal)
        const result: SourceRating = { ...base.google, ...data }
        writeCache(ck, result, CACHE_TTL)
        return result
      } catch (e) {
        // Quota was consumed; do not retry automatically to avoid burning calls
        const msg = (e as Error).message.includes('403')
          ? 'Google API key rejected — check referrer restrictions'
          : 'Google rating unavailable'
        return { ...base.google, error: msg }
      }
    })(),
    (async () => {
      const ck = cacheKey(place, cityLabel, 'yelp')
      const hit = readCache<SourceRating>(ck)
      if (hit) return hit
      try {
        const data = await fetchYelpRating(place, cityLabel, signal)
        const result: SourceRating = { ...base.yelp, ...data }
        writeCache(ck, result, CACHE_TTL)
        return result
      } catch {
        return { ...base.yelp, error: ratingsProxyUrl() ? 'Yelp rating unavailable' : 'Deploy ratings proxy (see Settings)' }
      }
    })(),
    (async () => {
      const ck = cacheKey(place, cityLabel, 'tripadvisor')
      const hit = readCache<SourceRating>(ck)
      if (hit) return hit
      try {
        const data = await fetchTripAdvisorRating(place, cityLabel, signal)
        const result: SourceRating = { ...base.tripadvisor, ...data }
        writeCache(ck, result, CACHE_TTL)
        return result
      } catch {
        return {
          ...base.tripadvisor,
          error: ratingsProxyUrl() ? 'TripAdvisor rating unavailable' : 'Deploy ratings proxy (see Settings)',
        }
      }
    })(),
  ])

  const combined = { google, yelp, tripadvisor }
  writeCache(cacheKey(place, cityLabel, 'all'), combined, CACHE_TTL)
  return combined
}

export function formatRating(r: SourceRating): string {
  if (r.rating == null) return '—'
  const stars = r.rating.toFixed(1)
  if (r.reviewCount != null) return `${stars} (${r.reviewCount.toLocaleString()})`
  return stars
}
