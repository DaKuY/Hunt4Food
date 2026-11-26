import { cacheTtlUntilEndOfUtcDay, readCache, utcDayKey, writeCache } from './storage'
import type { Restaurant } from './types'

export type SeedOilInfo = {
  grade: string | null
  risk: string | null
  cookingOil: string | null
  chain: string | null
  url: string
  loading?: boolean
  error?: string
}

// v3: drop cached grades that belonged to a different chain (fuzzy search matches).
const CACHE_VERSION = 'v3'
const API_BASE = 'https://seedoiltracker.com/ai'
const ATTRIBUTION = 'https://seedoiltracker.com'

function cacheKey(name: string): string {
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48)
  return `seedoil:${CACHE_VERSION}:${utcDayKey()}:${norm}`
}

function normalizeChainQuery(name: string): string {
  return name
    .replace(/\s*[-–—|]\s*.+$/, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+#\d+.*/, '')
    .trim()
}

function compact(value: string): string {
  return value.toLowerCase().replace(/^the\s+/, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && token !== 'the')
}

/**
 * Seed Oil Tracker's search is fuzzy: "Sushi Sakana" comes back as "Kura Sushi". A grade
 * belongs to a chain, so only keep it when the chain really is this restaurant:
 * the same name ("Chick-fil-A #123"), a name that starts with the chain
 * ("Chipotle Mexican Grill"), or every word of the chain in the name ("Kura Revolving Sushi Bar").
 */
export function chainMatchesName(chain: string, placeName: string): boolean {
  const name = normalizeChainQuery(placeName)
  const a = compact(chain)
  const b = compact(name)
  if (!a || !b) return false
  if (a === b) return true
  if (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) return true
  const chainTokens = tokens(chain)
  const nameTokens = new Set(tokens(name))
  return chainTokens.length >= 2 && chainTokens.every((token) => nameTokens.has(token))
}

function gradeScore(grade: string | null): number {
  if (!grade) return 0
  switch (grade.toUpperCase()) {
    case 'A':
      return 18
    case 'B':
      return 10
    case 'C':
      return 3
    case 'D':
      return -4
    case 'F':
      return -10
    default:
      return 0
  }
}

export { gradeScore as seedOilGradeScore }

type SearchResponse = {
  matches?: Array<{
    chain?: string
    grade?: string
    risk?: string
    cooking_oil?: string
    source?: string
  }>
  error?: string
}

function emptyInfo(error?: string): SeedOilInfo {
  return {
    grade: null,
    risk: null,
    cookingOil: null,
    chain: null,
    url: ATTRIBUTION,
    error,
  }
}

export function readCachedSeedOil(place: Restaurant): SeedOilInfo | null {
  return readCache<SeedOilInfo>(cacheKey(place.name))
}

async function fetchSearch(name: string, signal?: AbortSignal): Promise<SeedOilInfo> {
  const q = encodeURIComponent(normalizeChainQuery(name))
  const res = await fetch(`${API_BASE}/search?q=${q}&country=us`, { signal })
  if (!res.ok) throw new Error(`Seed Oil Tracker ${res.status}`)
  const data = (await res.json()) as SearchResponse
  const hit = data.matches?.find((match) => match.chain && chainMatchesName(match.chain, name))
  if (!hit) return emptyInfo()
  return {
    grade: hit.grade ?? null,
    risk: hit.risk ?? null,
    cookingOil: hit.cooking_oil ?? null,
    chain: hit.chain ?? null,
    url: hit.source ?? ATTRIBUTION,
  }
}

export async function fetchSeedOilInfo(place: Restaurant, signal?: AbortSignal): Promise<SeedOilInfo> {
  const cached = readCachedSeedOil(place)
  if (cached) return cached

  try {
    const info = await fetchSearch(place.name, signal)
    writeCache(cacheKey(place.name), info, cacheTtlUntilEndOfUtcDay())
    return info
  } catch {
    const result = emptyInfo('Seed-oil data unavailable')
    writeCache(cacheKey(place.name), result, cacheTtlUntilEndOfUtcDay())
    return result
  }
}

export function seedOilReason(info: SeedOilInfo): string | null {
  if (!info.grade) return null
  const oil = info.cookingOil ? ` — ${info.cookingOil.slice(0, 80)}${info.cookingOil.length > 80 ? '…' : ''}` : ''
  return `Seed Oil Tracker grade ${info.grade}${info.risk ? ` (${info.risk})` : ''}${oil}`
}
