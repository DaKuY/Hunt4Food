import { googleMapsUrl, tripadvisorUrl, yelpUrl } from './links'
import { consumeGoogleQuota, getGoogleQuota, googleQuotaMessage } from './googleQuota'
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

/** Fetch HTML via public CORS proxy (best-effort for Yelp / TripAdvisor). */
async function fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  const res = await fetch(proxy, { signal })
  if (!res.ok) throw new Error(`Proxy ${res.status}`)
  const data = (await res.json()) as { contents?: string }
  if (!data.contents) throw new Error('Empty proxy response')
  return data.contents
}

function parseJsonLdRating(html: string): { rating: number | null; count: number | null } {
  const blocks = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) ?? []
  for (const block of blocks) {
    const inner = block.replace(/<script[^>]*>|<\/script>/gi, '')
    try {
      const json = JSON.parse(inner) as Record<string, unknown>
      const items = Array.isArray(json) ? json : [json]
      for (const item of items) {
        const agg = item.aggregateRating as { ratingValue?: number | string; reviewCount?: number | string } | undefined
        if (agg?.ratingValue != null) {
          return {
            rating: Number(agg.ratingValue),
            count: agg.reviewCount != null ? Number(agg.reviewCount) : null,
          }
        }
      }
    } catch {
      // next block
    }
  }
  return { rating: null, count: null }
}

function parseYelpInline(html: string): { rating: number | null; count: number | null } {
  const mRating = html.match(/"rating":\s*(\d+(?:\.\d+)?)/)
  const mCount = html.match(/"reviewCount":\s*(\d+)/)
  if (mRating) {
    return { rating: Number(mRating[1]), count: mCount ? Number(mCount[1]) : null }
  }
  return parseJsonLdRating(html)
}

function parseTripAdvisorInline(html: string): { rating: number | null; count: number | null } {
  const mBubble = html.match(/bubble_rating rating-(\d+)/)
  if (mBubble) {
    const rating = Number(mBubble[1]) / 10
    const mCount = html.match(/(\d[\d,]*)\s+reviews/i)
    return { rating, count: mCount ? Number(mCount[1].replace(/,/g, '')) : null }
  }
  const mJson = html.match(/"rating":\s*(\d+(?:\.\d+)?)/)
  const mCount = html.match(/"num_reviews":\s*(\d+)/)
  if (mJson) {
    return { rating: Number(mJson[1]), count: mCount ? Number(mCount[1]) : null }
  }
  return parseJsonLdRating(html)
}

async function fetchYelpRating(
  place: Restaurant,
  cityLabel: string,
  signal?: AbortSignal,
): Promise<Pick<SourceRating, 'rating' | 'reviewCount' | 'url'>> {
  const searchUrl = yelpUrl(place, cityLabel)
  const html = await fetchHtml(searchUrl, signal)
  const { rating, count } = parseYelpInline(html)
  // Try to find first biz link for a cleaner URL
  const biz = html.match(/href="(\/biz\/[^"?]+)/)
  const url = biz ? `https://www.yelp.com${biz[1]}` : searchUrl
  return { rating, reviewCount: count, url }
}

async function fetchTripAdvisorRating(
  place: Restaurant,
  cityLabel: string,
  signal?: AbortSignal,
): Promise<Pick<SourceRating, 'rating' | 'reviewCount' | 'url'>> {
  const searchUrl = tripadvisorUrl(place, cityLabel)
  const html = await fetchHtml(searchUrl, signal)
  const { rating, count } = parseTripAdvisorInline(html)
  const loc = html.match(/href="(https:\/\/www\.tripadvisor\.com\/Restaurant_Review[^"]+)"/)
  const url = loc?.[1]?.replace(/&amp;/g, '&') ?? searchUrl
  return { rating, reviewCount: count, url }
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
        return { ...base.yelp, error: 'Yelp rating unavailable' }
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
        return { ...base.tripadvisor, error: 'TripAdvisor rating unavailable' }
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
