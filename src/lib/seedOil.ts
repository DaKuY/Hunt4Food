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

const CACHE_VERSION = 'v1'
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

type ChainResponse = {
  chain?: string
  grade?: string
  risk_level?: string
  cooking_oil?: string
  source?: string
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

async function fetchChain(name: string, signal?: AbortSignal): Promise<SeedOilInfo> {
  const q = encodeURIComponent(normalizeChainQuery(name))
  const res = await fetch(`${API_BASE}/chain?name=${q}&country=us`, { signal })
  if (!res.ok) throw new Error(`Seed Oil Tracker ${res.status}`)
  const data = (await res.json()) as ChainResponse
  if (!data.grade && !data.chain) return emptyInfo()
  return {
    grade: data.grade ?? null,
    risk: data.risk_level ?? null,
    cookingOil: data.cooking_oil ?? null,
    chain: data.chain ?? null,
    url: data.source ?? ATTRIBUTION,
  }
}

async function fetchSearch(name: string, signal?: AbortSignal): Promise<SeedOilInfo> {
  const q = encodeURIComponent(normalizeChainQuery(name))
  const res = await fetch(`${API_BASE}/search?q=${q}&country=us`, { signal })
  if (!res.ok) throw new Error(`Seed Oil Tracker ${res.status}`)
  const data = (await res.json()) as SearchResponse
  const hit = data.matches?.[0]
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
    let info = await fetchChain(place.name, signal)
    if (!info.grade) {
      info = await fetchSearch(place.name, signal)
    }
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
