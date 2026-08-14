import { tripadvisorUrl } from './links'
import type { Restaurant } from './types'

export type TripAdvisorLookup = {
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

export function parseTripAdvisorSearchHtml(
  html: string,
  place: Restaurant,
  cityLabel: string,
): TripAdvisorLookup {
  const fallbackUrl = tripadvisorUrl(place, cityLabel)
  const text = stripHtml(html)
  const nameLower = place.name.toLowerCase()

  const ratingMatch = text.match(/rated\s+(\d+(?:\.\d+)?)\s+of\s+5\s+on\s+tripadvisor/i)
  const countMatch = text.match(/see\s+(\d[\d,]*)\s+unbiased reviews/i)

  const linkMatch =
    html.match(/uddg=(https[^&"'\\]*tripadvisor\.com[^&"'\\]*Restaurant_Review[^&"'\\]*)/i) ||
    html.match(/href="(https:\/\/www\.tripadvisor\.com\/Restaurant_Review[^"]+)"/i)

  let url = fallbackUrl
  if (linkMatch) {
    try {
      url = decodeURIComponent(linkMatch[1].replace(/&amp;/g, '&'))
    } catch {
      url = linkMatch[1].replace(/&amp;/g, '&')
    }
  }

  if (ratingMatch) {
    const snippetAround = text.toLowerCase()
    if (snippetAround.includes(nameLower.slice(0, Math.min(6, nameLower.length)))) {
      return {
        rating: Number(ratingMatch[1]),
        reviewCount: countMatch ? Number(countMatch[1].replace(/,/g, '')) : null,
        url,
      }
    }
  }

  return { rating: null, reviewCount: null, url }
}

/** Browser fallback when Apps Script TripAdvisor lookup returns empty. */
export async function fetchTripAdvisorViaDdg(
  place: Restaurant,
  cityLabel: string,
  signal?: AbortSignal,
): Promise<TripAdvisorLookup> {
  const target = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
    `${place.name} ${cityLabel} tripadvisor restaurant`,
  )}`
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`
  const res = await fetch(proxy, { signal })
  if (!res.ok) throw new Error(`DDG proxy ${res.status}`)
  const data = (await res.json()) as { contents?: string }
  if (!data.contents) throw new Error('Empty DDG response')
  return parseTripAdvisorSearchHtml(data.contents, place, cityLabel)
}
