type ProviderSource = 'google' | 'yelp'

type ProviderCandidate = {
  source: ProviderSource
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
  /** Google's editorial summary ("Organic, plant-forward bowls…"): healthy evidence. */
  summary?: string
  servesVegetarianFood?: boolean
  matchedTerm: string
}

type ProviderResult = {
  places: ProviderCandidate[]
  sources: { google: boolean; yelp: boolean }
  warnings: string[]
}

const MAX_TERMS = 3
// Google bills Text Search per request, not per result: ask for the maximum (20).
export const GOOGLE_RESULTS_PER_TERM = 20
const YELP_RESULTS_PER_TERM = 8
const RADIUS_METERS = 16_000

function cleanTerms(url: URL): string[] {
  return (url.searchParams.get('terms') ?? '')
    .split('|')
    .map((term) => term.trim().replace(/[\r\n|]+/g, ' ').slice(0, 60))
    .filter(Boolean)
    .filter((term, index, all) => all.findIndex((other) => other.toLowerCase() === term.toLowerCase()) === index)
    .slice(0, MAX_TERMS)
}

/** Words that already name a kind of place: no "restaurant" suffix needed. */
const VENUE_WORD = /\b(?:restaurants?|cafe|café|kitchen|bar|juice|smoothies?|acai|açaí|bowls?|steakhouse|grill|bistro|bakery|poke|eatery|diner|market|deli|tavern)\b/i

/**
 * What to send as the search phrase. A brand ("Pure Green", "True Food Kitchen") or a venue
 * ("juice bar", "smoothie bowl") is searched as typed; "Pure Green restaurant" made Yelp miss the
 * juice bar. Plain foods ("wild salmon", "grass fed") get "restaurant" so markets don't win.
 */
export function searchPhrase(term: string): string {
  const brandLike = /[A-Z]/.test(term.trim()[0] ?? '')
  return brandLike || VENUE_WORD.test(term) ? term : `${term} restaurant`
}

function finiteCoordinate(raw: string | null, min: number, max: number): number | null {
  const value = Number(raw)
  return Number.isFinite(value) && value >= min && value <= max ? value : null
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
}

function dedupe(places: ProviderCandidate[]): ProviderCandidate[] {
  const out: ProviderCandidate[] = []
  for (const place of places) {
    const name = normalizeName(place.name)
    const duplicate = out.find(
      (candidate) =>
        candidate.source === place.source &&
        normalizeName(candidate.name) === name &&
        Math.abs(candidate.lat - place.lat) < 0.004 &&
        Math.abs(candidate.lon - place.lon) < 0.004,
    )
    if (!duplicate) out.push(place)
  }
  return out
}

export const GOOGLE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.priceLevel',
  'places.editorialSummary',
  'places.servesVegetarianFood',
].join(',')

async function googleSearch(
  apiKey: string,
  term: string,
  city: string,
  lat: number,
  lon: number,
): Promise<ProviderCandidate[]> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        // editorialSummary + servesVegetarianFood make this the Text Search "Enterprise + Atmosphere"
        // SKU (1,000 free requests a month, like the Enterprise SKU the rating already needed).
        GOOGLE_FIELD_MASK,
      referer: 'https://hunt4food.andrewcamero.com/',
    },
    body: JSON.stringify({
      textQuery: `${searchPhrase(term)} near ${city}`,
      maxResultCount: GOOGLE_RESULTS_PER_TERM,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lon },
          radius: RADIUS_METERS,
        },
      },
    }),
    signal: AbortSignal.timeout(7000),
  })

  if (!response.ok) throw new Error(`Google Places ${response.status}`)
  const data = (await response.json()) as {
    places?: Array<{
      id?: string
      displayName?: { text?: string }
      formattedAddress?: string
      location?: { latitude?: number; longitude?: number }
      types?: string[]
      primaryType?: string
      editorialSummary?: { text?: string }
      servesVegetarianFood?: boolean
      rating?: number
      userRatingCount?: number
      googleMapsUri?: string
      websiteUri?: string
      nationalPhoneNumber?: string
      priceLevel?: string
    }>
  }

  return (data.places ?? []).flatMap((place) => {
    const name = place.displayName?.text?.trim()
    const latitude = place.location?.latitude
    const longitude = place.location?.longitude
    if (!name || !place.id || latitude == null || longitude == null) return []
    return [{
      source: 'google' as const,
      id: place.id,
      name,
      lat: latitude,
      lon: longitude,
      address: place.formattedAddress,
      website: place.websiteUri,
      phone: place.nationalPhoneNumber,
      categories: Array.from(new Set([place.primaryType, ...(place.types ?? [])].filter((t): t is string => Boolean(t)))),
      rating: place.rating ?? null,
      reviewCount: place.userRatingCount ?? null,
      priceLevel: place.priceLevel ?? null,
      url: place.googleMapsUri ?? null,
      summary: place.editorialSummary?.text?.trim().slice(0, 400) || undefined,
      servesVegetarianFood: place.servesVegetarianFood ?? undefined,
      matchedTerm: term,
    }]
  })
}

async function yelpSearch(
  apiKey: string,
  term: string,
  lat: number,
  lon: number,
): Promise<ProviderCandidate[]> {
  const url = new URL('https://api.yelp.com/v3/businesses/search')
  url.searchParams.set('term', searchPhrase(term))
  // Restaurants plus food spots (juice bars, smoothies, cafés), never unrelated businesses.
  url.searchParams.set('categories', 'restaurants,food')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('radius', String(RADIUS_METERS))
  url.searchParams.set('limit', String(YELP_RESULTS_PER_TERM))
  url.searchParams.set('sort_by', 'best_match')

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(7000),
  })
  if (!response.ok) throw new Error(`Yelp ${response.status}`)

  const data = (await response.json()) as {
    businesses?: Array<{
      id?: string
      name?: string
      coordinates?: { latitude?: number; longitude?: number }
      location?: { display_address?: string[] }
      categories?: Array<{ alias?: string; title?: string }>
      rating?: number
      review_count?: number
      price?: string
      url?: string
      display_phone?: string
    }>
  }

  return (data.businesses ?? []).flatMap((business) => {
    const latitude = business.coordinates?.latitude
    const longitude = business.coordinates?.longitude
    if (!business.id || !business.name || latitude == null || longitude == null) return []
    return [{
      source: 'yelp' as const,
      id: business.id,
      name: business.name,
      lat: latitude,
      lon: longitude,
      address: business.location?.display_address?.join(', '),
      phone: business.display_phone,
      categories: (business.categories ?? [])
        .flatMap((category) => [category.alias, category.title])
        .filter((value): value is string => Boolean(value)),
      rating: business.rating ?? null,
      reviewCount: business.review_count ?? null,
      price: business.price ?? null,
      url: business.url ?? null,
      matchedTerm: term,
    }]
  })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    const url = new URL(request.url)
    const lat = finiteCoordinate(url.searchParams.get('lat'), -90, 90)
    const lon = finiteCoordinate(url.searchParams.get('lon'), -180, 180)
    const city = (url.searchParams.get('city') ?? '').trim().slice(0, 100)
    const terms = cleanTerms(url)

    if (lat == null || lon == null || !city || terms.length === 0) {
      return Response.json({ error: 'Missing or invalid discovery parameters' }, { status: 400 })
    }

    const googleKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY || ''
    const yelpKey = process.env.YELP_API_KEY || ''
    const warnings: string[] = []
    const tasks: Array<Promise<ProviderCandidate[]>> = []

    for (const term of terms) {
      if (googleKey) {
        tasks.push(
          googleSearch(googleKey, term, city, lat, lon).catch((error) => {
            warnings.push(error instanceof Error ? error.message : 'Google discovery failed')
            return []
          }),
        )
      }
      if (yelpKey) {
        tasks.push(
          yelpSearch(yelpKey, term, lat, lon).catch((error) => {
            warnings.push(error instanceof Error ? error.message : 'Yelp discovery failed')
            return []
          }),
        )
      }
    }

    const batches = tasks.length ? await Promise.all(tasks) : []
    const result: ProviderResult = {
      places: dedupe(batches.flat()),
      sources: { google: Boolean(googleKey), yelp: Boolean(yelpKey) },
      warnings: Array.from(new Set(warnings)),
    }

    return Response.json(result, {
      headers: {
        'cache-control': 'private, max-age=600, stale-while-revalidate=1800',
      },
    })
  },
}
