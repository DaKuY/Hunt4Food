import { googleMapsUrl } from './links'
import type { Restaurant } from './types'

export type GoogleMapsLookup = {
  rating: number | null
  reviewCount: number | null
  url: string
}

/** Strip HTML so DDG/Bing snippets parse reliably. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

function nameInSnippet(text: string, placeName: string): boolean {
  const nameLower = placeName.toLowerCase()
  const snippet = text.toLowerCase()
  if (snippet.includes(nameLower.slice(0, Math.min(8, nameLower.length)))) return true
  const tokens = nameLower.split(/[^a-z0-9]+/).filter((t) => t.length > 2)
  return tokens.some((t) => snippet.includes(t))
}

export function parseGoogleSearchHtml(
  html: string,
  place: Restaurant,
  cityLabel: string,
): GoogleMapsLookup {
  const fallbackUrl = googleMapsUrl(place, cityLabel)
  const text = stripHtml(html)

  const ratingMatch =
    text.match(/(\d+\.?\d*)\s*(?:stars?|★)/i) ||
    text.match(/rated\s+(\d+\.?\d*)\s+out\s+of\s+5/i) ||
    text.match(/(\d+\.?\d*)\s+on\s+Google/i)
  const countMatch = text.match(/(\d[\d,]*)\s+(?:Google\s+)?reviews/i)

  const linkMatch =
    html.match(/uddg=(https[^&"'\\]*google\.com\/maps[^&"'\\]*)/i) ||
    html.match(/href="(https:\/\/(?:www\.)?google\.com\/maps\/place[^"]+)"/i) ||
    html.match(/href="(https:\/\/maps\.google\.com[^"]+)"/i)

  let url = fallbackUrl
  if (linkMatch) {
    try {
      url = decodeURIComponent(linkMatch[1].replace(/&amp;/g, '&'))
    } catch {
      url = linkMatch[1].replace(/&amp;/g, '&')
    }
  }

  if (ratingMatch && nameInSnippet(text, place.name)) {
    const rating = Number(ratingMatch[1])
    if (rating >= 1 && rating <= 5) {
      return {
        rating,
        reviewCount: countMatch ? Number(countMatch[1].replace(/,/g, '')) : null,
        url,
      }
    }
  }

  return { rating: null, reviewCount: null, url: fallbackUrl }
}

/** Browser fallback when the proxy Google lookup returns empty. */
export async function fetchGoogleViaDdg(
  place: Restaurant,
  cityLabel: string,
  signal?: AbortSignal,
): Promise<GoogleMapsLookup> {
  const target = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
    `${place.name} ${cityLabel} google maps restaurant`,
  )}`
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`
  const res = await fetch(proxy, { signal })
  if (!res.ok) throw new Error(`DDG proxy ${res.status}`)
  const data = (await res.json()) as { contents?: string }
  if (!data.contents) throw new Error('Empty DDG response')
  return parseGoogleSearchHtml(data.contents, place, cityLabel)
}
