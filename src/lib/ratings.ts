import { googleMapsUrl, tripadvisorUrl, yelpUrl } from './links'
import { consumeGoogleQuota, getGoogleQuota, googleQuotaMessage } from './googleQuota'
import { googlePriceLevel, mergePrice, yelpPriceLevel, type PriceLevel, type PriceRange } from './priceRange'
import { jsonpGet, ratingsProxyUrl } from './ratingsProxy'
import { cacheTtlUntilEndOfUtcDay, readCache, utcDayKey, writeCache } from './storage'
import { loadSettings } from './settings'
import type { Restaurant } from './types'

export { getGoogleQuota, googleQuotaMessage } from './googleQuota'

export type SourceRating = {
  source: 'google' | 'yelp' | 'tripadvisor'
  rating: number | null
  reviewCount: number | null
  url: string
  priceLevel?: PriceLevel | null
  priceLabel?: string | null
  loading?: boolean
  error?: string
}

export type PlaceRatings = {
  google: SourceRating
  yelp: SourceRating
  tripadvisor: SourceRating
  price: PriceRange
}

const CACHE_VERSION = 'v7'

function cacheKey(place: Restaurant, cityLabel: string, source: string): string {
  return `rating:${CACHE_VERSION}:${utcDayKey()}:${source}:${place.id}:${cityLabel.slice(0, 40)}`
}

function cacheTtl(): number {
  return cacheTtlUntilEndOfUtcDay()
}

function emptyRatings(place: Restaurant, cityLabel: string): PlaceRatings {
  const emptyPrice: PriceRange = { level: null, label: null, source: null }
  return {
    google: { source: 'google', rating: null, reviewCount: null, url: googleMapsUrl(place, cityLabel) },
    yelp: { source: 'yelp', rating: null, reviewCount: null, url: yelpUrl(place, cityLabel) },
    tripadvisor: {
      source: 'tripadvisor',
      rating: null,
      reviewCount: null,
      url: tripadvisorUrl(place, cityLabel),
    },
    price: emptyPrice,
  }
}

function withPrice(ratings: PlaceRatings): PlaceRatings {
  return {
    ...ratings,
    price: mergePrice(ratings.google.priceLevel ?? null, ratings.yelp.priceLevel ?? null),
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

  const tokensA = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
  const tokensB = returned
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
  if (tokensA.length && tokensB.length) {
    const overlap = tokensA.filter((t) => tokensB.some((u) => u.includes(t) || t.includes(u)))
    if (overlap.length >= 1) return true
  }

  return false
}

function isFailedRating(value: SourceRating): boolean {
  return value.rating == null && Boolean(value.error)
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
  const ttl = isFailedRating(value) ? 10 * 60 * 1000 : cacheTtl()
  writeCache(cacheKey(place, cityLabel, source), value, ttl)
}

/** Synchronous read for instant display on refresh (same UTC day only). */
export function readCachedPlaceRatings(place: Restaurant, cityLabel: string): PlaceRatings | null {
  const base = emptyRatings(place, cityLabel)
  const google = readSourceCache(place, cityLabel, 'google')
  const yelp = readSourceCache(place, cityLabel, 'yelp')
  const tripadvisor = readSourceCache(place, cityLabel, 'tripadvisor')
  if (!google && !yelp && !tripadvisor) return null
  return withPrice({
    google: google ?? base.google,
    yelp: yelp ?? base.yelp,
    tripadvisor: tripadvisor ?? base.tripadvisor,
    price: base.price,
  })
}

async function fetchGooglePlacesRating(
  place: Restaurant,
  cityLabel: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<Pick<SourceRating, 'rating' | 'reviewCount' | 'url' | 'priceLevel' | 'priceLabel'>> {
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

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), 6000)
  const onAbort = () => timeout.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      signal: timeout.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.priceLevel',
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
        priceLevel?: string
      }>
    }

    const hit = data.places?.[0]
    const fallbackUrl = googleMapsUrl(place, cityLabel)
    if (!hit) {
      return { rating: null, reviewCount: null, url: fallbackUrl, priceLevel: null, priceLabel: null }
    }

    const priceLevel = googlePriceLevel(hit.priceLevel)
    const priceLabel = priceLevel != null ? mergePrice(priceLevel, null).label : null

    return {
      rating: hit.rating ?? null,
      reviewCount: hit.userRatingCount ?? null,
      url: hit.googleMapsUri ?? fallbackUrl,
      priceLevel,
      priceLabel,
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

async function fetchProxyRating(
  source: 'google' | 'yelp' | 'tripadvisor',
  place: Restaurant,
  cityLabel: string,
): Promise<Pick<SourceRating, 'rating' | 'reviewCount' | 'url' | 'priceLevel' | 'priceLabel' | 'error'>> {
  const proxy = ratingsProxyUrl()
  const fallbackUrl =
    source === 'google'
      ? googleMapsUrl(place, cityLabel)
      : source === 'yelp'
        ? yelpUrl(place, cityLabel)
        : tripadvisorUrl(place, cityLabel)
  if (!proxy) {
    throw new Error('Ratings proxy not configured')
  }

  const params: Record<string, string> = {
    source,
    name: place.name,
    city: cityLabel,
    lat: String(place.lat),
    lon: String(place.lon),
  }
  if (source === 'google') {
    const key = loadSettings().googlePlacesApiKey
    if (key) params.googleKey = key
  }

  const data = await jsonpGet<{
    rating?: number | null
    reviewCount?: number | null
    url?: string
    price?: string | null
    priceLevel?: string | number | null
    matchedName?: string | null
    error?: string
  }>(proxy, params)

  if (data.error && data.rating == null && data.priceLevel == null && data.price == null) {
    throw new Error(data.error)
  }

  const priceLevel =
    source === 'google'
      ? googlePriceLevel(data.priceLevel)
      : source === 'yelp'
        ? yelpPriceLevel(data.price)
        : null
  const priceLabel = priceLevel != null ? mergePrice(priceLevel, null).label : null

  let rating = data.rating ?? null
  let reviewCount = data.reviewCount ?? null
  if (
    source === 'google' &&
    data.matchedName &&
    rating != null &&
    !namesSimilar(place.name, data.matchedName)
  ) {
    rating = null
    reviewCount = null
  }

  return {
    rating,
    reviewCount,
    url: data.url || fallbackUrl,
    priceLevel,
    priceLabel,
    error: data.error,
  }
}

async function resolveGoogleRating(
  place: Restaurant,
  cityLabel: string,
  signal?: AbortSignal,
): Promise<SourceRating> {
  const base = emptyRatings(place, cityLabel).google
  const cached = readSourceCache(place, cityLabel, 'google')
  if (cached && (!isFailedRating(cached) || cached.rating != null)) return cached

  if (signal?.aborted) return base

  const settings = loadSettings()
  if (settings.googlePlacesApiKey && getGoogleQuota().canRequest) {
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
      if (signal?.aborted) return base
      // Referrer-blocked keys fall through to the Apps Script proxy
      const blocked = (e as Error).message.includes('403')
      if (!blocked && ratingsProxyUrl() === '') {
        const result: SourceRating = { ...base, error: 'Google rating unavailable' }
        writeSourceCache(place, cityLabel, 'google', result)
        return result
      }
    }
  }

  if (ratingsProxyUrl()) {
    try {
      const data = await fetchProxyRating('google', place, cityLabel)
      const result: SourceRating = { ...base, ...data }
      writeSourceCache(place, cityLabel, 'google', result)
      return result
    } catch {
      // continue to error
    }
  }

  const result: SourceRating = {
    ...base,
    error: settings.googlePlacesApiKey
      ? 'Google rating unavailable'
      : 'Google Places key not configured',
  }
  writeSourceCache(place, cityLabel, 'google', result)
  return result
}

export { emptyRatings as emptyPlaceRatings, withPrice as withPlacePrice }

export const fetchGoogleRating = resolveGoogleRating
export const fetchYelpRating = (place: Restaurant, cityLabel: string, signal?: AbortSignal) =>
  resolveProxyRating('yelp', place, cityLabel, signal)
export const fetchTripadvisorRating = (place: Restaurant, cityLabel: string, signal?: AbortSignal) =>
  resolveProxyRating('tripadvisor', place, cityLabel, signal)

async function resolveProxyRating(
  source: 'yelp' | 'tripadvisor',
  place: Restaurant,
  cityLabel: string,
  signal?: AbortSignal,
): Promise<SourceRating> {
  const base = emptyRatings(place, cityLabel)[source]
  const cached = readSourceCache(place, cityLabel, source)
  if (cached && (!isFailedRating(cached) || cached.rating != null)) return cached

  if (signal?.aborted) return base

  try {
    const data = await fetchProxyRating(source, place, cityLabel)
    const result: SourceRating = { ...base, ...data }
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
    return withPrice({ google: googleCached, yelp: yelpCached, tripadvisor: taCached, price: emptyRatings(place, cityLabel).price })
  }

  const [google, yelp, tripadvisor] = await Promise.all([
    googleCached ? Promise.resolve(googleCached) : resolveGoogleRating(place, cityLabel, signal),
    yelpCached ? Promise.resolve(yelpCached) : resolveProxyRating('yelp', place, cityLabel, signal),
    taCached ? Promise.resolve(taCached) : resolveProxyRating('tripadvisor', place, cityLabel, signal),
  ])

  return withPrice({ google, yelp, tripadvisor, price: emptyRatings(place, cityLabel).price })
}

export function formatRating(r: SourceRating): string {
  if (r.rating == null) return '—'
  const stars = r.rating.toFixed(1)
  if (r.reviewCount != null) return `${stars} (${r.reviewCount.toLocaleString()})`
  return stars
}
