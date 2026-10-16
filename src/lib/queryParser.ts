import { CUISINES } from '../data/cuisines'
import type { PriceLevel } from './priceRange'
import type { CuisineId, DietaryId, HealthyFocusId } from './types'

/**
 * Plain-language search: "Find me a Mexican restaurant near Coppell TX that
 * doesn't have seed oils" → cuisine, place and requirements. Rule-based on
 * purpose: instant, free, private, and predictable for a fixed vocabulary.
 */
export type ParsedQuery = {
  cuisines: CuisineId[]
  dietary: DietaryId[]
  healthy: boolean
  healthyFocus: HealthyFocusId[]
  /** Place to search around ("Coppell TX"); null means use the current or nearby area. */
  location: string | null
  nearMe: boolean
  maxMiles: number | null
  priceLevels: PriceLevel[]
  openNow: boolean
  /** "with a lunch special / deal / combo": verified lunch specials first. */
  lunchSpecial: boolean
  /** Plain "lunch": skip places that only open for dinner. */
  lunch: boolean
  /** Words left over when nothing else matched, e.g. "birria". */
  keyword: string
}

const LOCATION_STOP =
  '(?:that|which|who|where|with|without|w/o|and|but|under|below|less|within|open|serving|for|doesn\'?t|does not|don\'?t|do not|no|not|using|cooked|cheap|budget|fancy|upscale)'
const LOCATION = new RegExp(`\\b(?:near|in|around|by|close to|nearby)\\s+(.+?)(?=\\s+${LOCATION_STOP}\\b|[.!?;]|$)`)

const DIETARY_RULES: Array<{ id: DietaryId; pattern: RegExp }> = [
  {
    id: 'no_seed_oils',
    // "no / without / doesn't have / avoid seed oils", "seed-oil free", or any mention of seed oils.
    pattern: /seed[-\s]?oils?|vegetable oil|canola/,
  },
  { id: 'gluten_free', pattern: /gluten[-\s]?free|\bceliac\b|no gluten|without gluten/ },
  { id: 'vegan', pattern: /\bvegan\b|plant[-\s]?based/ },
  { id: 'vegetarian', pattern: /\bvegetarian\b|\bveggie\b/ },
  { id: 'halal', pattern: /\bhalal\b/ },
  { id: 'grass_fed', pattern: /grass[-\s]?fed|pasture[-\s]?raised|regenerative/ },
]

const FOCUS_RULES: Array<{ id: HealthyFocusId; pattern: RegExp }> = [
  { id: 'smoothie', pattern: /\bsmoothies?\b|\bjuice\b|\bacai\b|açaí/ },
  { id: 'steak', pattern: /\bsteaks?\b|steakhouse/ },
  { id: 'seafood', pattern: /\bsalmon\b|seafood|\bfish\b|\bsushi\b|\bpoke\b/ },
  { id: 'plant', pattern: /\bvegan\b|\bvegetarian\b|\bsalads?\b|plant[-\s]?based/ },
  { id: 'clean', pattern: /\borganic\b|clean (?:eating|food|kitchen)|farm[-\s]?to[-\s]?table/ },
]

/** Words that carry no search meaning on their own. */
const FILLER = new Set(
  ('find me a an the some good best great place places spot spots restaurant restaurants food eat eating ' +
    'to get want i im i\'m looking for show give that which with has have doesn\'t doesnt does not use uses ' +
    'using cooked cook in near around by close nearby me please any free without no dont don\'t avoid oil oils ' +
    'seed open now cheap budget fancy upscale under within miles mile mi of is are serves serving options option ' +
    'lunch lunches special specials deal deals combo combos menu')
    .split(' '),
)

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesWord(text: string, phrase: string): boolean {
  return new RegExp(`\\b${escapeRegExp(phrase.toLowerCase())}s?\\b`).test(text)
}

function snapMiles(miles: number): number {
  return [1, 3, 5, 10].find((choice) => miles <= choice) ?? 10
}

export function parseSearchQuery(raw: string): ParsedQuery {
  // "Coppell, TX" → "coppell tx" so the place survives punctuation-based stops.
  let text = raw.toLowerCase().replace(/[’']/g, "'").replace(/,\s*([a-z]{2})\b/g, ' $1').replace(/\s+/g, ' ').trim()

  let location: string | null = null
  let nearMe = /\bnear me\b|\bnearby\b|\baround me\b|\bclose to me\b|\bclose by\b/.test(text)
  const locationMatch = text.match(LOCATION)
  if (locationMatch) {
    const place = locationMatch[1].replace(/\b(?:area|here)\b/g, '').trim()
    if (place && !/^(me|here|my area)$/.test(place)) location = place
    else nearMe = true
    // Keep cuisine words inside the place name ("near Salmon St") out of the food match.
    text = text.replace(locationMatch[0], ' ')
  }

  const dietary = DIETARY_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.id)
  const healthy = /\bhealthy\b|\bhealthier\b|clean eating|clean food/.test(text)
  const healthyFocus = healthy ? FOCUS_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.id) : []

  // Cuisine labels first ("Mexican"), then their keywords ("taqueria" → Mexican/Tacos).
  const cuisines: CuisineId[] = []
  for (const cuisine of CUISINES) {
    if (cuisine.id === 'healthy' || cuisines.length >= 3) continue
    if (matchesWord(text, cuisine.label)) cuisines.push(cuisine.id)
  }
  // Keywords only when no cuisine was named outright ("taqueria"), so "burger" doesn't also add American.
  for (const cuisine of cuisines.length ? [] : CUISINES) {
    if (cuisine.id === 'healthy' || cuisines.length >= 3 || cuisines.includes(cuisine.id)) continue
    if (cuisine.keywords.some((keyword) => keyword.length > 3 && matchesWord(text, keyword))) {
      // "taco" also matches Mexican's keywords; keep one of a pair that share tags.
      const overlaps = cuisines.some((id) => CUISINES.find((c) => c.id === id)?.osmTags[0] === cuisine.osmTags[0])
      if (!overlaps) cuisines.push(cuisine.id)
    }
  }
  // In healthy mode, foods like steak or smoothies are a focus, not a separate cuisine filter.
  const foodCuisines = healthy ? cuisines.filter((id) => !['steak', 'salmon', 'smoothie', 'salad', 'seafood', 'vegan'].includes(id)) : cuisines

  let maxMiles: number | null = null
  const within = text.match(/within (\d+(?:\.\d+)?) ?(?:mi|miles?)\b/) ?? text.match(/(\d+(?:\.\d+)?) ?(?:mi|miles?) (?:away|radius)/)
  if (within) maxMiles = snapMiles(Number(within[1]))

  let priceLevels: PriceLevel[] = []
  if (/\bcheap\b|\binexpensive\b|\bbudget\b|\baffordable\b/.test(text)) priceLevels = [1, 2]
  else if (/\bfancy\b|\bupscale\b|\bfine dining\b|\bsplurge\b/.test(text)) priceLevels = [3, 4]
  const dollars = text.match(/under \$?(\${1,4}|\d+)/)
  if (dollars) {
    const level = dollars[1].startsWith('$') ? dollars[1].length : Number(dollars[1]) <= 15 ? 1 : Number(dollars[1]) <= 30 ? 2 : 3
    priceLevels = ([1, 2, 3, 4] as PriceLevel[]).filter((l) => l <= level)
  }

  const openNow = /\bopen now\b|\bopen right now\b|\bstill open\b|\bopen late\b/.test(text)
  const lunchSpecial = /\blunch(?:time)?\s+(?:specials?|deals?|combos?|menu|prix[-\s]?fixe|plates?)\b|\b(?:cheap|quick|express|business)\s+lunch\b/.test(text)
  const lunch = lunchSpecial || /\blunch\b/.test(text)

  let keyword = ''
  if (!foodCuisines.length && !healthy) {
    keyword = text
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word && !FILLER.has(word) && !/^\d+$/.test(word))
      .join(' ')
      .trim()
  }

  return {
    cuisines: foodCuisines,
    dietary,
    healthy,
    healthyFocus,
    location,
    nearMe: nearMe && !location,
    maxMiles,
    priceLevels,
    openNow,
    lunchSpecial,
    lunch,
    keyword,
  }
}

/** Short human summary of what was understood, for the confirmation line. */
export function describeParsedQuery(parsed: ParsedQuery, cuisineLabel: (id: CuisineId) => string): string[] {
  const parts: string[] = []
  if (parsed.healthy) parts.push('Healthy')
  parts.push(...parsed.cuisines.map(cuisineLabel))
  if (parsed.keyword) parts.push(`“${parsed.keyword}”`)
  if (parsed.location) parts.push(`near ${parsed.location.replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b([A-Z][a-z])$/, (s) => s.toUpperCase())}`)
  else if (parsed.nearMe) parts.push('near you')
  if (parsed.dietary.includes('no_seed_oils')) parts.push('no seed oils')
  for (const id of parsed.dietary) {
    if (id === 'gluten_free') parts.push('gluten-free')
    else if (id === 'grass_fed') parts.push('grass-fed')
    else if (id !== 'no_seed_oils') parts.push(id)
  }
  if (parsed.maxMiles) parts.push(`within ${parsed.maxMiles} mi`)
  if (parsed.priceLevels.length) parts.push(parsed.priceLevels.map((l) => '$'.repeat(l)).join('/'))
  if (parsed.lunchSpecial) parts.push('lunch special')
  else if (parsed.lunch) parts.push('open for lunch')
  if (parsed.openNow) parts.push('open now')
  return parts
}
