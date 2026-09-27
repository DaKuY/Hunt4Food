import { readJson, writeJson } from './storage'
import type { CitySelection, DietaryId, TastePlace, TasteProfile } from './types'

const KEY = 'taste'
const MAX_LOVED = 80
const MAX_SKIPPED = 80

export function emptyTaste(): TasteProfile {
  return {
    version: 1,
    loved: [],
    skipped: [],
    cuisineWeights: {},
    dietaryPrefs: [],
    vibeWeights: {},
  }
}

export function rebuildTasteWeights(taste: TasteProfile): TasteProfile {
  const cuisineWeights: Record<string, number> = {}
  const vibeWeights: Record<string, number> = {}

  const addCuisine = (cuisines: string[], delta: number) => {
    for (const cuisine of cuisines) {
      const key = cuisine.toLowerCase()
      cuisineWeights[key] = (cuisineWeights[key] ?? 0) + delta
    }
  }

  for (const place of taste.loved) {
    addCuisine(place.cuisines, 2)
    for (const vibe of place.vibeTags) vibeWeights[vibe] = (vibeWeights[vibe] ?? 0) + 1
  }
  for (const place of taste.skipped) addCuisine(place.cuisines, -1)

  return { ...taste, cuisineWeights, vibeWeights }
}

export function loadTaste(): TasteProfile {
  const t = readJson<TasteProfile>(KEY, emptyTaste())
  if (t.version !== 1) return emptyTaste()
  return rebuildTasteWeights({
    ...emptyTaste(),
    ...t,
    loved: t.loved ?? [],
    skipped: t.skipped ?? [],
    dietaryPrefs: t.dietaryPrefs ?? [],
  })
}

export function saveTaste(taste: TasteProfile): void {
  const normalized = rebuildTasteWeights({
    ...taste,
    loved: taste.loved.slice(0, MAX_LOVED),
    skipped: taste.skipped.slice(0, MAX_SKIPPED),
  })
  writeJson(KEY, normalized)
}

export function lovePlace(taste: TasteProfile, place: Omit<TastePlace, 'savedAt'> & { savedAt?: string }): TasteProfile {
  const next = structuredClone(taste)
  next.skipped = next.skipped.filter((s) => s.name.toLowerCase() !== place.name.toLowerCase())
  next.loved = [
    {
      ...place,
      rating: place.rating ?? 5,
      vibeTags: place.vibeTags ?? [],
      cuisines: place.cuisines ?? [],
      savedAt: place.savedAt ?? new Date().toISOString(),
    },
    ...next.loved.filter((l) => l.name.toLowerCase() !== place.name.toLowerCase()),
  ].slice(0, MAX_LOVED)
  const normalized = rebuildTasteWeights(next)
  saveTaste(normalized)
  return normalized
}

export function skipPlace(taste: TasteProfile, place: Omit<TastePlace, 'savedAt'> & { savedAt?: string }): TasteProfile {
  const next = structuredClone(taste)
  next.loved = next.loved.filter((l) => l.name.toLowerCase() !== place.name.toLowerCase())
  next.skipped = [
    {
      ...place,
      rating: place.rating ?? 1,
      vibeTags: place.vibeTags ?? [],
      cuisines: place.cuisines ?? [],
      savedAt: place.savedAt ?? new Date().toISOString(),
    },
    ...next.skipped.filter((s) => s.name.toLowerCase() !== place.name.toLowerCase()),
  ].slice(0, MAX_SKIPPED)
  const normalized = rebuildTasteWeights(next)
  saveTaste(normalized)
  return normalized
}

export function setDietaryPrefs(taste: TasteProfile, dietary: DietaryId[]): TasteProfile {
  const next = { ...taste, dietaryPrefs: dietary }
  saveTaste(next)
  return next
}

export function removeLoved(taste: TasteProfile, id: string): TasteProfile {
  const next = rebuildTasteWeights({ ...taste, loved: taste.loved.filter((l) => l.id !== id) })
  saveTaste(next)
  return next
}

export function exportTaste(taste: TasteProfile): string {
  return JSON.stringify(taste, null, 2)
}

export function importTaste(json: string): TasteProfile {
  const parsed = JSON.parse(json) as TasteProfile
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.loved)) {
    throw new Error('Invalid taste profile JSON')
  }
  const next = rebuildTasteWeights({
    ...emptyTaste(),
    ...parsed,
    loved: (parsed.loved ?? []).slice(0, MAX_LOVED),
    skipped: (parsed.skipped ?? []).slice(0, MAX_SKIPPED),
  })
  saveTaste(next)
  return next
}

export type ShortlistItem = {
  id: string
  name: string
  lat: number
  lon: number
  city?: string
}

const SHORTLIST_KEY = 'shortlist'

export function loadShortlist(): ShortlistItem[] {
  return readJson<ShortlistItem[]>(SHORTLIST_KEY, []).slice(0, 40)
}

export function saveShortlist(items: ShortlistItem[]): void {
  writeJson(SHORTLIST_KEY, items.slice(0, 40))
}

export function toggleShortlist(items: ShortlistItem[], item: ShortlistItem): ShortlistItem[] {
  const exists = items.some((i) => i.id === item.id)
  const next = exists ? items.filter((i) => i.id !== item.id) : [item, ...items]
  saveShortlist(next)
  return next
}

export type RecentCity = {
  label: string
  lat: number
  lon: number
  south: number
  west: number
  north: number
  east: number
}

const RECENT_KEY = 'recentCities'

export function loadRecentCities(): RecentCity[] {
  return readJson<RecentCity[]>(RECENT_KEY, []).slice(0, 8)
}

export function recentToCitySelection(recent: RecentCity): CitySelection {
  return {
    label: recent.label,
    center: { lat: recent.lat, lon: recent.lon },
    bounds: { south: recent.south, west: recent.west, north: recent.north, east: recent.east },
    source: 'search',
  }
}

export function pushRecentCity(city: RecentCity): RecentCity[] {
  const next = [city, ...loadRecentCities().filter((c) => c.label !== city.label)].slice(0, 8)
  writeJson(RECENT_KEY, next)
  return next
}
