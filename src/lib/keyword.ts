import type { Restaurant } from './types'

export const KEYWORD_SUGGESTIONS = [
  'wild caught fish',
  'grass fed steak',
  'organic fruit',
  'pasture raised',
  'wild salmon',
  'raw honey',
  'sourdough bread',
] as const

export function normalizeKeyword(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function placeSearchBlob(place: Restaurant): string {
  return `${place.name} ${place.cuisineRaw ?? ''} ${place.cuisines.join(' ')} ${place.discoveryTerms?.join(' ') ?? ''} ${place.amenity ?? ''}`.toLowerCase()
}

/**
 * Dishes people search by name that listings rarely spell out. "Chicken strips" is
 * what Raising Cane's, Guthrie's or a "chicken" place sells, though no listing says
 * "strips". Most such places are counter service, so these searches may show fast food.
 */
type DishGroup = { match: RegExp; known: RegExp; related: RegExp }

const DISH_GROUPS: DishGroup[] = [
  {
    match: /\bchicken (?:strips?|tenders?|fingers?|nuggets?)\b|^(?:tenders|strips|chicken fingers)$/,
    known:
      /\bchicken (?:strips?|tenders?|fingers?|nuggets?)\b|\btenders\b|raising cane|guthrie|huey magoo|slim chicken|golden chick|\bpdq\b|zaxby|chick fil a|layne s|\bcanes\b/,
    related: /\bchicken\b|popeyes|bojangles|\bkfc\b/,
  },
  {
    match: /^(?:chicken |buffalo |hot )?wings?$/,
    known: /\bwings?\b|wingstop|wing stop|buffalo wild/,
    related: /\bchicken\b/,
  },
]

function dishGroup(normalized: string): DishGroup | undefined {
  return DISH_GROUPS.find((group) => group.match.test(normalized))
}

/** Searches like "chicken strips", where the best places are mostly counter service. */
export function dishSearchAllowsFastFood(keyword: string): boolean {
  return Boolean(dishGroup(normalizeKeyword(keyword)))
}

export function keywordBoost(
  place: Restaurant,
  keyword: string,
): { points: number; reasons: string[] } {
  const normalized = normalizeKeyword(keyword)
  if (!normalized) return { points: 0, reasons: [] }

  const blob = placeSearchBlob(place)
  const name = place.name.toLowerCase()
  const reasons: string[] = []
  let points = 0

  const dish = dishGroup(normalized)
  if (dish) {
    const text = blob.replace(/[-_'’]+/g, ' ')
    if (dish.known.test(text)) {
      return { points: 22, reasons: [`Known for ${keyword.trim()}`] }
    }
    if (dish.related.test(text)) {
      return { points: 14, reasons: [`Chicken spot — likely has ${keyword.trim()}`] }
    }
  }

  if (blob.includes(normalized)) {
    points += name.includes(normalized) ? 22 : 16
    reasons.push(`Matches your keyword “${keyword.trim()}”`)
    return { points, reasons }
  }

  const tokens = normalized.split(' ').filter((t) => t.length >= 3)
  if (tokens.length >= 2) {
    const matched = tokens.filter((t) => blob.includes(t))
    if (matched.length === tokens.length) {
      points += 12
      reasons.push(`Listing mentions terms from “${keyword.trim()}”`)
    } else if (matched.length >= Math.ceil(tokens.length / 2)) {
      points += 6
      reasons.push(`Partial match for “${keyword.trim()}”`)
    }
  } else if (tokens.length === 1 && blob.includes(tokens[0]!)) {
    points += 10
    reasons.push(`Matches your keyword “${keyword.trim()}”`)
  }

  return { points, reasons }
}
