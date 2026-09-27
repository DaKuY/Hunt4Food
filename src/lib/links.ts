import type { Restaurant } from './types'

/** Third-party URLs (OSM tags, proxy/API responses) render as live hrefs: allow http(s) only. */
export function safeExternalUrl(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : fallback
  } catch {
    return fallback
  }
}

export function googleMapsUrl(place: Restaurant, cityLabel: string): string {
  const q = encodeURIComponent(`${place.name} ${cityLabel}`.trim())
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

export function yelpUrl(place: Restaurant, cityLabel: string): string {
  const findDesc = encodeURIComponent(place.name)
  const findLoc = encodeURIComponent(cityLabel)
  return `https://www.yelp.com/search?find_desc=${findDesc}&find_loc=${findLoc}`
}

export function openTableUrl(place: Restaurant, cityLabel: string): string {
  const q = encodeURIComponent(`${place.name} ${cityLabel}`.trim())
  return `https://www.opentable.com/s?term=${q}`
}

export function tripadvisorUrl(place: Restaurant, cityLabel: string): string {
  const q = encodeURIComponent(`${place.name} ${cityLabel} restaurant`)
  return `https://www.tripadvisor.com/Search?q=${q}`
}

export function menuOrWebsiteUrl(place: Restaurant, cityLabel: string): { href: string; label: string } {
  const q = encodeURIComponent(`${place.name} ${cityLabel} menu`)
  const search = `https://www.google.com/search?q=${q}`
  if (place.website) {
    const raw = /^https?:\/\//i.test(place.website) ? place.website : `https://${place.website}`
    const href = safeExternalUrl(raw, '')
    if (href) return { href, label: 'Website' }
  }
  return {
    href: search,
    label: 'Find menu',
  }
}

export function cityCuisineFallbackLinks(
  cityLabel: string,
  cuisineLabels: string[],
  keyword?: string,
): { google: string; yelp: string; tripadvisor: string } {
  const kw = keyword?.trim()
  const food = [kw, ...cuisineLabels].filter(Boolean).join(' ')
  const gq = encodeURIComponent(`best ${food} restaurants in ${cityLabel}`)
  const yDesc = encodeURIComponent(food || 'restaurants')
  const yLoc = encodeURIComponent(cityLabel)
  const taQ = encodeURIComponent(`best ${food} restaurants ${cityLabel}`)
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${gq}`,
    yelp: `https://www.yelp.com/search?find_desc=${yDesc}&find_loc=${yLoc}`,
    tripadvisor: `https://www.tripadvisor.com/Search?q=${taQ}`,
  }
}

export function buildSearchShareUrl(params: URLSearchParams): string {
  const qs = params.toString()
  return `${window.location.origin}${window.location.pathname}#/${qs ? `?${qs}` : ''}`
}
