import { googleMapsUrl, tripadvisorUrl, yelpUrl } from './links'
import { consumeGoogleQuota, getGoogleQuota, googleQuotaMessage } from './googleQuota'
import { jsonpGet, ratingsProxyUrl } from './ratingsProxy'
import { cacheTtlUntilEndOfUtcDay, readCache, utcDayKey, writeCache } from './storage'
import { loadSettings } from './settings'
import { fetchTripAdvisorViaDdg } from './tripadvisor'
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

const CACHE_VERSION = 'v4'

function cacheKey(place: Restaurant, cityLabel: string, source: string): string {
  return `rating:${CACHE_VERSION}:${utcDayKey()}:${source}:${place.id}:${cityLabel.slice(0, 40)}`
}

function cacheTtl(): number {
  return cacheTtlUntilEndOfUtcDay()
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

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Loose match so Google Text Search results map to the OSM place name. */
function namesSimilar(query: string, returned: string): boolean {
  const a = normalizeName(query)
  const b = normalizeName(returned)
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  if (a.length >= 5 && b.length >= 5 && a.slice(0, 6) === b.slice(0, 6)) return true
  return false
}

function readSourceCache(
  place: Restaurant,
  cityLabel: string,
  source: 'google' | 'yelp' | 'tripadvisor',
): SourceRating | null {
  return readCache<SourceRating>(cacheKey(place, cityLabel, source))
}

function writeSourceCache(
  place: Restaurant,
  cityLabel: string,
  source: 'google' | 'yelp' | 'tripadvisor',
  value: SourceRating,
): void {
  writeCache(cacheKey(place, cityLabel, source), value, cacheTtl())
}

/** Synchronous read for instant display on refresh (same UTC day only). */
export function readCachedPlaceRatings(place: Restaurant, cityLabel: string): PlaceRatings | null {
  const base = emptyRatings(place, cityLabel)
  const google = readSourceCache(place, cityLabel, 'google')
  const yelp = readSourceCache(place, cityLabel, 'yelp')
  const tripadvisor = readSourceCache(place, cityLabel, 'tripadvisor')
  if (!google && !yelp && !tripadvisor) return null
  return {
    google: google ?? base.google,
    yelp: yelp ?? base.yelp,
    tripadvisor: tripadvisor ?? base.tripadvisor,
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
        radius: 500,
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
  const fallbackUrl = googleMapsUrl(place, cityLabel)
  if (!hit) {
    return { rating: null, reviewCount: null, url: fallbackUrl }
  }

  const returnedName = hit.displayName?.text ?? ''
  if (!namesSimilar(place.name, returnedName)) {
    return { rating: null, reviewCount: null, url: hit.googleMapsUri ?? fallbackUrl }
  }

  return {
    rating: hit.rating ?? null,
    reviewCount: hit.userRatingCount ?? null,
    url: hit.googleMapsUri ?? fallbackUrl,
  }
}

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

async function resolveGoogleRating(
  place: Restaurant,
  cityLabel: string,
  signal?: AbortSignal,
): Promise<SourceRating> {
  const base = emptyRatings(place, cityLabel).google
  const cached = readSourceCache(place, cityLabel, 'google')
  if (cached) return cached

  const settings = loadSettings()
  if (!settings.googlePlacesApiKey) {
    const result = { ...base, error: 'Google Places key not configured' }
    writeSourceCache(place, cityLabel, 'google', result)
    return result
  }
  if (!getGoogleQuota().canRequest) {
    const result = { ...base, error: googleQuotaMessage() }
    writeSourceCache(place, cityLabel, 'google', result)
    return result
  }

  try {
    const data = await fetchGooglePlacesRating(place, cityLabel, settings.googlePlacesApiKey, signal)
    if (!consumeGoogleQuota()) {
      const result = { ...base, error: googleQuotaMessage() }
      writeSourceCache(place, cityLabel, 'google', result)
      return result
    }
    const result: SourceRating = { ...base, ...data }
    writeSourceCache(place, cityLabel, 'google', result)
    return result
  } catch (e) {
    const msg = (e as Error).message.includes('403')
      ? 'Google API key rejected — check referrer restrictions'
      : 'Google rating unavailable'
    const result: SourceRating = { ...base, error: msg }
    writeSourceCache(place, cityLabel, 'google', result)
    return result
  }
}

async function resolveProxyRating(
  source: 'yelp' | 'tripadvisor',
  place: Restaurant,
  cityLabel: string,
  signal?: AbortSignal,
): Promise<SourceRating> {
  const base = emptyRatings(place, cityLabel)[source]
  const cached = readSourceCache(place, cityLabel, source)
  if (cached) return cached

  if (signal?.aborted) return base

  try {
    const data = await fetchProxyRating(source, place, cityLabel)
    let result: SourceRating = { ...base, ...data }

    if (source === 'tripadvisor' && result.rating == null && !signal?.aborted) {
      try {
        const ddg = await fetchTripAdvisorViaDdg(place, cityLabel, signal)
        if (ddg.rating != null) {
          result = { ...base, rating: ddg.rating, reviewCount: ddg.reviewCount, url: ddg.url }
        }
      } catch {
        // keep proxy result
      }
    }

    writeSourceCache(place, cityLabel, source, result)
    return result
  } catch {
    const msg =
      source === 'yelp'
        ? ratingsProxyUrl()
          ? 'Yelp rating unavailable'
          : 'Deploy ratings proxy (see Settings)'
        : ratingsProxyUrl()
          ? 'TripAdvisor rating unavailable'
          : 'Deploy ratings proxy (see Settings)'
    const result: SourceRating = { ...base, error: msg }
    writeSourceCache(place, cityLabel, source, result)
    return result
  }
}

export async function fetchPlaceRatings(
  place: Restaurant,
  cityLabel: string,
  signal?: AbortSignal,
): Promise<PlaceRatings> {
  const googleCached = readSourceCache(place, cityLabel, 'google')
  const yelpCached = readSourceCache(place, cityLabel, 'yelp')
  const taCached = readSourceCache(place, cityLabel, 'tripadvisor')

  if (googleCached && yelpCached && taCached) {
    return { google: googleCached, yelp: yelpCached, tripadvisor: taCached }
  }

  const [google, yelp, tripadvisor] = await Promise.all([
    googleCached ? Promise.resolve(googleCached) : resolveGoogleRating(place, cityLabel, signal),
    yelpCached ? Promise.resolve(yelpCached) : resolveProxyRating('yelp', place, cityLabel, signal),
    taCached ? Promise.resolve(taCached) : resolveProxyRating('tripadvisor', place, cityLabel, signal),
  ])

  return { google, yelp, tripadvisor }
}

export function formatRating(r: SourceRating): string {
  if (r.rating == null) return '—'
  const stars = r.rating.toFixed(1)
  if (r.reviewCount != null) return `${stars} (${r.reviewCount.toLocaleString()})`
  return stars
}
