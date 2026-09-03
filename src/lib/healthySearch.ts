import { jsonpGet, ratingsProxyUrl } from './ratingsProxy'
import { cacheTtlUntilEndOfUtcDay, readCache, utcDayKey, writeCache } from './storage'
import { seedSourceRating } from './ratings'
import { googlePriceLevel, yelpPriceLevel } from './priceRange'
import { rankRestaurants } from './rank'
import {
  assignHealthyLane,
  evidenceLine,
  extractHealthySignals,
  hasPrimaryHealthyEvidence,
  healthyInstantBoost,
  healthyQualityTier,
  healthySignalScore,
  isQualityWholeFoodFallback,
  mergeSignals,
} from './healthySignals'
import type {
  CitySelection,
  CuisineId,
  DietaryId,
  HealthyLane,
  LatLng,
  RankedRestaurant,
  Restaurant,
  TasteProfile,
} from './types'

export type HealthyDiscoverPlace = {
  id: string
  name: string
  lat: number | null
  lon: number | null
  address?: string
  rating?: number | null
  reviewCount?: number | null
  price?: string | null
  priceLevel?: string | null
  url?: string | null
  categories?: string[]
  phone?: string | null
  editorialSummary?: string
  lane?: HealthyLane | null
  source?: 'yelp' | 'google'
}

export type HealthySnippet = {
  text?: string
  url?: string | null
  source?: 'opentable' | 'google_snippet' | 'yelp_review' | 'tripadvisor'
}

export type HealthyDiscoverResponse = {
  places?: HealthyDiscoverPlace[]
  snippets?: HealthySnippet[]
  error?: string
}

export type HealthyReviewsResponse = {
  reviews?: Record<string, Array<{ text?: string; url?: string | null; rating?: number | null }>>
  error?: string
}

export type HealthySearchProgress = {
  status: string
  places?: RankedRestaurant[]
}

const SEARCH_BUDGET_MS = 25_000
const DISCOVER_TIMEOUT_MS = 20_000
const REVIEWS_TIMEOUT_MS = 20_000

function haversineKm(a: LatLng, b: LatLng): number {
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

function cacheKey(city: CitySelection): string {
  const b = [city.bounds.south, city.bounds.west, city.bounds.north, city.bounds.east]
    .map((n) => n.toFixed(3))
    .join(',')
  return `healthySearch:v2:${utcDayKey()}:${b}`
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function namesSimilar(a: string, b: string): boolean {
  const x = normalizeName(a)
  const y = normalizeName(b)
  if (!x || !y) return false
  if (x === y) return true
  if (x.length >= 5 && y.length >= 5 && (x.includes(y) || y.includes(x))) return true
  return x.slice(0, 8) === y.slice(0, 8)
}

function nearby(a: Restaurant, lat: number | null, lon: number | null): boolean {
  if (lat == null || lon == null) return true
  return haversineKm({ lat: a.lat, lon: a.lon }, { lat, lon }) < 0.35
}

function discoveredToRestaurant(hit: HealthyDiscoverPlace): Restaurant | null {
  if (!hit.name || hit.lat == null || hit.lon == null) return null
  const source = hit.source === 'google' ? 'google' : 'yelp'
  const id = hit.id ? `${source}/${hit.id}` : `${source}/${normalizeName(hit.name)}`
  return {
    id,
    name: hit.name,
    lat: hit.lat,
    lon: hit.lon,
    cuisines: (hit.categories ?? []).map((c) => c.toLowerCase()),
    address: hit.address || undefined,
    phone: hit.phone || undefined,
    website: hit.url || undefined,
    cuisineRaw: hit.categories?.join(', '),
    yelpId: source === 'yelp' ? hit.id : undefined,
  }
}

function seedRatingsFromDiscover(place: Restaurant, cityLabel: string, hit: HealthyDiscoverPlace) {
  if (hit.source === 'google' && (hit.rating != null || hit.url)) {
    seedSourceRating(place, cityLabel, 'google', {
      rating: hit.rating ?? null,
      reviewCount: hit.reviewCount ?? null,
      ...(hit.url ? { url: hit.url } : {}),
      priceLevel: googlePriceLevel(hit.priceLevel),
    })
  }
  if (hit.source === 'yelp' && (hit.rating != null || hit.url)) {
    seedSourceRating(place, cityLabel, 'yelp', {
      rating: hit.rating ?? null,
      reviewCount: hit.reviewCount ?? null,
      ...(hit.url ? { url: hit.url } : {}),
      priceLevel: yelpPriceLevel(hit.price ?? null),
    })
  }
}

function applySnippets(
  places: RankedRestaurant[],
  snippets: HealthySnippet[],
): RankedRestaurant[] {
  if (!snippets.length) return places
  return places.map((place) => {
    const name = place.name.toLowerCase()
    const hits = snippets.filter((s) => {
      const text = `${s.text ?? ''} ${s.url ?? ''}`.toLowerCase()
      return text.includes(name.slice(0, Math.min(name.length, 12))) || text.includes(normalizeName(place.name).slice(0, 8))
    })
    if (!hits.length) return place

    let signals = place.signals ?? []
    for (const snip of hits) {
      const source =
        snip.source === 'opentable'
          ? 'opentable'
          : snip.source === 'tripadvisor'
            ? 'tripadvisor'
            : 'google_snippet'
      signals = mergeSignals(signals, extractHealthySignals(snip.text ?? '', source))
    }
    return {
      ...place,
      signals,
      evidenceQuote: evidenceLine(signals) ?? place.evidenceQuote,
    }
  })
}

function scoreHealthyPlace(
  place: RankedRestaurant,
  opts: { selectedCuisines: CuisineId[]; keyword?: string },
): RankedRestaurant {
  const boost = healthyInstantBoost(place)
  const signals = mergeSignals(place.signals ?? [], boost.signals)
  const identityBoost = Math.max(0, boost.points - healthySignalScore(boost.signals))
  const baseScore = place.baseScore ?? place.score
  let score = baseScore + healthySignalScore(signals) + identityBoost
  const reasons = [...place.reasons, ...boost.reasons]

  if (hasPrimaryHealthyEvidence(signals)) {
    score += 10
    reasons.unshift(
      `Prioritized for clean-food evidence: ${signals
        .filter((signal) => ['grass_fed', 'pasture_raised', 'no_seed_oils', 'avocado_oil', 'organic', 'wild_caught', 'locally_sourced'].includes(signal.id))
        .map((signal) => signal.label.toLowerCase())
        .slice(0, 3)
        .join(', ')}`,
    )
  } else if (isQualityWholeFoodFallback(place, signals)) {
    score += 6
    reasons.unshift('Quality whole-food fallback when stronger clean-food evidence is limited')
  }

  if (opts.selectedCuisines.includes('salmon') && signals.some((s) => s.id === 'salmon')) {
    score += 12
    reasons.push('Matches your Salmon pick')
  }
  if (opts.selectedCuisines.includes('smoothie') && (boost.lane === 'smoothie' || signals.some((s) => s.id === 'smoothie'))) {
    score += 8
    reasons.push('Matches your Smoothie pick')
  }
  if (opts.keyword?.trim()) {
    const kw = opts.keyword.trim().toLowerCase()
    if (`${place.name} ${place.cuisines.join(' ')}`.toLowerCase().includes(kw)) score += 10
  }

  const lane = place.lane ?? assignHealthyLane(place, signals, boost.lane)
  const uniq = Array.from(new Set(reasons)).slice(0, 4)
  return {
    ...place,
    baseScore,
    score,
    reasons: uniq.length ? uniq : ['Healthy match for this area'],
    lane,
    signals,
    evidenceQuote: evidenceLine(signals) ?? place.evidenceQuote,
  }
}

export function pickHealthyLanes(
  ranked: RankedRestaurant[],
  limit = 10,
  excludeIds?: Iterable<string>,
): RankedRestaurant[] {
  const exclude = excludeIds ? new Set(excludeIds) : new Set<string>()
  return ranked
    .filter((place) => !exclude.has(place.id))
    .sort((a, b) => {
      const tierDiff = healthyQualityTier(a, a.signals ?? []) - healthyQualityTier(b, b.signals ?? [])
      if (tierDiff !== 0) return tierDiff
      return b.score - a.score
    })
    .slice(0, limit)
}

async function fetchHealthyDiscover(
  city: CitySelection,
): Promise<HealthyDiscoverResponse> {
  const proxy = ratingsProxyUrl()
  if (!proxy) return { places: [], snippets: [], error: 'Ratings proxy not configured' }
  return jsonpGet<HealthyDiscoverResponse>(
    proxy,
    {
      source: 'healthyDiscover',
      city: city.label,
      lat: String(city.center.lat),
      lon: String(city.center.lon),
    },
    DISCOVER_TIMEOUT_MS,
  )
}

async function fetchHealthyReviews(
  places: RankedRestaurant[],
  cityLabel: string,
): Promise<HealthyReviewsResponse> {
  const proxy = ratingsProxyUrl()
  if (!proxy) return { reviews: {} }
  const withYelp = places.filter((p) => p.yelpId).slice(0, 12)
  if (!withYelp.length) return { reviews: {} }
  return jsonpGet<HealthyReviewsResponse>(
    proxy,
    {
      source: 'healthyReviews',
      city: cityLabel,
      ids: withYelp.map((p) => p.yelpId).join(','),
      names: withYelp.map((p) => p.name.replace(/\|/g, ' ')).join('|'),
    },
    REVIEWS_TIMEOUT_MS,
  )
}

function mergeDiscoverIntoPool(
  osm: Restaurant[],
  discovered: HealthyDiscoverPlace[],
  cityLabel: string,
): Restaurant[] {
  const pool = [...osm]
  for (const hit of discovered) {
    const match = pool.find((p) => namesSimilar(p.name, hit.name) && nearby(p, hit.lat, hit.lon))
    if (match) {
      if (hit.source === 'yelp' && hit.id) match.yelpId = hit.id
      if (!match.address && hit.address) match.address = hit.address
      if (!match.phone && hit.phone) match.phone = hit.phone
      if (!match.website && hit.url) match.website = hit.url
      seedRatingsFromDiscover(match, cityLabel, hit)
      continue
    }
    const created = discoveredToRestaurant(hit)
    if (!created) continue
    seedRatingsFromDiscover(created, cityLabel, hit)
    pool.push(created)
  }
  return pool
}

function attachDiscoverMeta(
  ranked: RankedRestaurant[],
  discovered: HealthyDiscoverPlace[],
): RankedRestaurant[] {
  return ranked.map((place) => {
    const hit = discovered.find((d) => namesSimilar(d.name, place.name))
    const extraText = [hit?.editorialSummary, hit?.categories?.join(' ')].filter(Boolean).join(' ')
    let signals = place.signals ?? []
    if (extraText) signals = mergeSignals(signals, extractHealthySignals(extraText, 'listing'))
    const hint = hit?.lane ?? place.lane
    const lane = assignHealthyLane(place, signals, hint)
    if (hit?.source === 'yelp' && hit.id && !place.yelpId) {
      return { ...place, yelpId: hit.id, lane, signals, sourceKind: place.id.startsWith('yelp/') ? 'yelp' : place.sourceKind }
    }
    return { ...place, lane, signals }
  })
}

function applyReviews(
  places: RankedRestaurant[],
  reviews: HealthyReviewsResponse['reviews'],
): RankedRestaurant[] {
  if (!reviews) return places
  return places.map((place) => {
    const key = place.yelpId
    const list = key ? reviews[key] : undefined
    if (!list?.length) return place
    let signals = place.signals ?? []
    for (const rev of list) {
      signals = mergeSignals(signals, extractHealthySignals(rev.text ?? '', 'yelp_review'))
    }
    return {
      ...place,
      signals,
      evidenceQuote: evidenceLine(signals) ?? place.evidenceQuote,
      reasons: Array.from(
        new Set([
          ...(signals.length
            ? [`Review mentions ${signals.map((s) => s.label.toLowerCase()).slice(0, 3).join(', ')}`]
            : []),
          ...place.reasons,
        ]),
      ).slice(0, 4),
    }
  })
}

export function attachSeedOilSignals(
  places: RankedRestaurant[],
  seedOilByPlaceId: Record<string, { grade?: string | null; cookingOil?: string | null }>,
): RankedRestaurant[] {
  return places.map((place) => {
    const info = seedOilByPlaceId[place.id]
    if (!info) return place
    const extra = `${info.grade ?? ''} ${info.cookingOil ?? ''}`
    const incoming = extractHealthySignals(extra, 'seed_oil')
    if (info.grade && /A|B/i.test(info.grade)) {
      incoming.push({
        id: 'no_seed_oils',
        label: 'No seed oils',
        source: 'seed_oil',
        quote: info.cookingOil || `Seed Oil Tracker grade ${info.grade}`,
      })
    }
    if (!incoming.length) return place
    const signals = mergeSignals(place.signals ?? [], incoming)
    return { ...place, signals, evidenceQuote: evidenceLine(signals) ?? place.evidenceQuote }
  })
}

function rankHealthyPool(
  pool: Restaurant[],
  opts: {
    center: LatLng
    selectedCuisines: CuisineId[]
    dietary: DietaryId[]
    keyword?: string
    taste: TasteProfile
  },
  discovered: HealthyDiscoverPlace[] = [],
  snippets: HealthySnippet[] = [],
): RankedRestaurant[] {
  const base = rankRestaurants(pool, {
    center: opts.center,
    selectedCuisines: opts.selectedCuisines,
    dietary: opts.dietary,
    keyword: opts.keyword,
    taste: opts.taste,
    limit: pool.length,
  }).map((p) => {
    const instant = healthyInstantBoost(p)
    return {
      ...p,
      baseScore: p.score,
      reasons: Array.from(new Set([...instant.reasons, ...p.reasons])).slice(0, 4),
      lane: instant.lane,
      signals: instant.signals,
      evidenceQuote: evidenceLine(instant.signals),
      yelpId: p.yelpId,
      sourceKind: p.id.startsWith('yelp/') ? 'yelp' : p.id.startsWith('google/') ? 'google' : 'osm',
    } satisfies RankedRestaurant
  })
  const withMeta = attachDiscoverMeta(base, discovered)
  const withSnips = applySnippets(withMeta, snippets)
  return withSnips.map((p) => scoreHealthyPlace(p, opts))
}

export async function runHealthyHunt(opts: {
  city: CitySelection
  selectedCuisines: CuisineId[]
  dietary: DietaryId[]
  keyword?: string
  taste: TasteProfile
  osmPlaces: Restaurant[]
  signal?: AbortSignal
  onProgress?: (update: HealthySearchProgress) => void
}): Promise<{ displayed: RankedRestaurant[]; pool: RankedRestaurant[] }> {
  const key = cacheKey(opts.city)
  const cached = readCache<{ displayed: RankedRestaurant[]; pool: RankedRestaurant[] }>(key)
  if (cached?.displayed?.length) {
    opts.onProgress?.({ status: 'Loaded saved healthy search for today.', places: cached.displayed })
    return cached
  }

  const deadline = Date.now() + SEARCH_BUDGET_MS
  const remaining = () => deadline - Date.now()
  const dietary: DietaryId[] = Array.from(new Set([...opts.dietary, 'grass_fed', 'no_seed_oils']))
  const rankOpts = {
    center: opts.city.center,
    selectedCuisines: opts.selectedCuisines,
    dietary,
    keyword: opts.keyword,
    taste: opts.taste,
  }

  let pool = opts.osmPlaces
  let ranked = rankHealthyPool(pool, rankOpts)
  let displayed = pickHealthyLanes(ranked)
  opts.onProgress?.({
    status: 'Looking first for clean-food evidence such as grass-fed, pasture-raised, organic, and clean oils…',
    places: displayed,
  })

  let discovered: HealthyDiscoverPlace[] = []
  let snippets: HealthySnippet[] = []

  if (remaining() > 1500 && !opts.signal?.aborted) {
    try {
      const data = await fetchHealthyDiscover(opts.city)
      if (!opts.signal?.aborted) {
        discovered = data.places ?? []
        snippets = data.snippets ?? []
        pool = mergeDiscoverIntoPool(pool, discovered, opts.city.label)
        ranked = rankHealthyPool(pool, rankOpts, discovered, snippets)
        displayed = pickHealthyLanes(ranked)
        opts.onProgress?.({
          status:
            'Checking listings and reviews for grass-fed, no seed oils, avocado oil, organic sourcing, then salmon and quality whole-food fallbacks…',
          places: displayed,
        })
      }
    } catch {
      opts.onProgress?.({
        status: 'Review search is limited right now — showing the best non-fast-food healthy matches.',
        places: displayed,
      })
    }
  }

  if (remaining() > 2000 && !opts.signal?.aborted && displayed.some((p) => p.yelpId)) {
    try {
      const data = await fetchHealthyReviews(displayed, opts.city.label)
      if (!opts.signal?.aborted) {
        ranked = applyReviews(ranked, data.reviews)
        ranked = ranked.map((p) => scoreHealthyPlace(p, rankOpts))
        displayed = pickHealthyLanes(ranked)
      }
    } catch {
      // keep discover-only evidence
    }
  }

  const result = { displayed, pool: ranked }
  writeCache(key, result, cacheTtlUntilEndOfUtcDay())
  opts.onProgress?.({
    status:
      'Clean-food signals come from public listings and reviews; when none are found, Hunt4Food falls back to quality whole-food restaurants.',
    places: displayed,
  })
  return result
}
