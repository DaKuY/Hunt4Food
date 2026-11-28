import { CUISINES } from '../data/cuisines'
import { KNOWN_HEALTHY_CHAINS } from './healthySignals'
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
  /** "no smoothies": leave out places that are mainly that kind of spot. */
  healthyAvoid: HealthyFocusId[]
  /** "fast", "quick", "grab and go": counter-service places first. */
  quick: boolean
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
  /** A healthy brand named outright ("True Food Kitchen"); also set as the keyword. */
  brand: string | null
  /**
   * Trailing words that may be a place typed without "in"/"near" ("healthy food Coppell",
   * "acai bowl plano"). The caller geocodes it; if it is not a town, it goes back into the keyword.
   */
  placeGuess: string | null
}

/** Mentions that mean "the healthy hunt" even without the word healthy. */
const HEALTHY_TRIGGERS =
  /\b(?:smoothies?|acai|açaí|juices?|juice bars?|salmon|poke|grass[-\s]?fed|pasture[-\s]?raised|seed[-\s]?oils?|avocado oil|tallow|organic|clean|salads?|wild[-\s]?caught|farm[-\s]?to[-\s]?table|whole ?30|paleo|keto|anti[-\s]?inflammatory|nutritious|protein bowls?|grain bowls?|nourish)\b/
/** Foods that the healthy hunt covers as a focus rather than as a separate cuisine filter. */
const HEALTHY_FOODS = new Set<CuisineId>(['steak', 'salmon', 'smoothie', 'salad', 'seafood', 'vegan', 'bowl'])

/** Words that end a trailing place guess: numbers, units and question words are never a town. */
const NOT_A_PLACE = /^(?:\d+|mi|miles?|km|now|today|tonight|tomorrow|what|where|who|how|please|thanks|ok|okay)$/

const LOCATION_STOP =
  '(?:that|which|who|where|with|without|w/o|and|but|under|below|less|within|open|serving|for|doesn\'?t|does not|don\'?t|do not|no|not|using|cooked|cheap|budget|fancy|upscale)'
const LOCATION = new RegExp(`\\b(?:near|in|around|by|close to|nearby)\\s+(.+?)(?=\\s+${LOCATION_STOP}\\b|[.!?;]|$)`)

const STATE_CODES =
  'al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc'
const STATE_NAMES =
  'alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming'
const AMBIGUOUS_STATES = new Set(['in', 'me', 'or', 'hi', 'ok', 'oh'])
/** "... Coppell TX" / "... Frisco Texas" with no "in"/"near": a trailing US state marks the place. */
const TRAILING_STATE = new RegExp(`\\s((?:${STATE_CODES.split(' ').join('|')})|${STATE_NAMES})$`)

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

/** "no smoothies", "without steakhouses", "not seafood": kinds of healthy to leave out. */
const AVOID_WORDS: Array<{ id: HealthyFocusId; words: string }> = [
  { id: 'smoothie', words: '(?:smoothies?|smoothie bowls?|juice(?:s| bars?)?|acai(?: bowls?)?|açaí)' },
  { id: 'steak', words: '(?:steaks?|steakhouses?|steak houses?)' },
  { id: 'seafood', words: '(?:seafood|fish|salmon|sushi)' },
  { id: 'plant', words: '(?:salads?|vegan|vegetarian)' },
]
const AVOID_LEAD = "(?:no|not|without|w/o|skip|except|excluding|exclude|minus|but not|other than|nothing like|don'?t want|dont want|no more)"

/** Words that carry no search meaning on their own. */
const FILLER = new Set(
  ('find me a an the some good best great place places spot spots restaurant restaurants food eat eating ' +
    'to get want i im i\'m looking for show give that which with has have doesn\'t doesnt does not use uses ' +
    'using cooked cook in near around by close nearby me please any free without no dont don\'t avoid oil oils ' +
    'seed open now cheap budget fancy upscale under within miles mile mi of is are serves serving options option ' +
    'lunch lunches special specials deal deals combo combos menu fast quick express grab go casual counter hurry')
    .split(' '),
)

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesWord(text: string, phrase: string): boolean {
  return new RegExp(`\\b${escapeRegExp(phrase.toLowerCase())}s?\\b`).test(text)
}

/** Words that name food, so "healthy salmon Dallas TX" keeps "salmon" out of the city. */
function isFoodWord(word: string): boolean {
  if (/^(?:healthy|healthier|clean|organic|grass|fed|vegan|vegetarian|gluten|halal|keto|paleo|smoothies?|juice|salads?|bowls?|steaks?|salmon|fish|seafood|tacos?|burgers?|pizza|sushi|bbq|brunch|breakfast|dinner|coffee|cafe)$/.test(word)) return true
  return CUISINES.some(
    (cuisine) =>
      matchesWord(word, cuisine.label) || cuisine.keywords.some((keyword) => !keyword.includes(' ') && matchesWord(word, keyword)),
  )
}

function snapMiles(miles: number): number {
  return [1, 3, 5, 10].find((choice) => miles <= choice) ?? 10
}

export function parseSearchQuery(raw: string): ParsedQuery {
  // "Coppell, TX" → "coppell tx" so the place survives punctuation-based stops.
  let text = raw.toLowerCase().replace(/[’']/g, "'").replace(/,\s*([a-z]{2})\b/g, ' $1').replace(/\s+/g, ' ').trim()

  // Healthy brands first, so "True Food Kitchen" keeps "food" and "kitchen".
  let brand: string | null = null
  let brandLane: string | null = null
  for (const chain of KNOWN_HEALTHY_CHAINS) {
    const alias = [chain.name.toLowerCase(), ...chain.aliases].sort((a, b) => b.length - a.length).find((a) => matchesWord(text, a))
    if (!alias) continue
    brand = chain.name
    brandLane = chain.lane
    text = text.replace(new RegExp(`\\b${escapeRegExp(alias)}(?:'?s)?\\b(?:\\s+(?:cafe|café|kitchen|juice bar))?`), ' ').replace(/\s+/g, ' ').trim()
    break
  }

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

  if (!location) {
    const state = text.match(TRAILING_STATE)
    // "in", "me", "or", "hi", "ok", "oh" are words too: only a state when written "IN" or ", in".
    const ambiguous = state && AMBIGUOUS_STATES.has(state[1]!) && !new RegExp(`(?:,\\s*${state[1]}|\\b${state[1]!.toUpperCase()})\\s*$`).test(raw.trim())
    if (state && state.index !== undefined && !ambiguous) {
      // Walk back over the city name: stop at the first word that means food or filler.
      const before = text.slice(0, state.index).split(' ')
      const city: string[] = []
      while (before.length && city.length < 3) {
        const word = before[before.length - 1]!
        if (FILLER.has(word) || isFoodWord(word)) break
        city.unshift(before.pop()!)
      }
      if (city.length) {
        location = `${city.join(' ')} ${state[1]}`
        nearMe = false
        text = before.join(' ')
      }
    }
  }

  // "healthy food Coppell", "acai bowl plano", "Coppell": trailing words that are not food or filler.
  let placeGuess: string | null = null
  if (!location && !nearMe) {
    const words = text.replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(Boolean)
    const guess: string[] = []
    while (words.length && guess.length < 3) {
      const word = words[words.length - 1]!
      if (FILLER.has(word) || isFoodWord(word) || NOT_A_PLACE.test(word)) break
      guess.unshift(words.pop()!)
    }
    if (guess.length) {
      placeGuess = guess.join(' ')
      text = words.join(' ')
    }
  }

  // "no smoothies" first, and cut it out so "smoothies" isn't also read as a focus.
  const healthyAvoid: HealthyFocusId[] = []
  for (const rule of AVOID_WORDS) {
    const re = new RegExp(`\\b${AVOID_LEAD}\\s+(?:(?:any|more|the|places?|spots?|shops?|like)\\s+){0,2}${rule.words}(?:\\s*(?:,|or|and|/)\\s*${rule.words})*\\b`, 'g')
    if (re.test(text)) {
      healthyAvoid.push(rule.id)
      text = text.replace(re, ' ')
    }
  }
  const quick = /\b(?:fast|quick|express|grab[- ]and[- ]go|on the go|in a hurry|fast[- ]casual|counter service)\b/.test(text)

  const dietary = DIETARY_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.id)
  const explicitHealthy = /\bhealthy\b|\bhealthier\b|clean eating|clean food/.test(text)

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
  // Smoothies, salmon, grass-fed, no seed oils, a healthy brand…: the healthy hunt, unless a
  // regular cuisine was named ("Mexican without seed oils" stays a Mexican search).
  const healthy =
    explicitHealthy ||
    Boolean(brand) ||
    (HEALTHY_TRIGGERS.test(text) && cuisines.every((id) => HEALTHY_FOODS.has(id)))
  const healthyFocus: HealthyFocusId[] = healthy
    ? FOCUS_RULES.filter((rule) => rule.pattern.test(text) && !healthyAvoid.includes(rule.id)).map((rule) => rule.id)
    : []
  if (brandLane === 'smoothie' && !healthyFocus.includes('smoothie')) healthyFocus.push('smoothie')
  // In healthy mode, foods like steak or smoothies are a focus, not a separate cuisine filter.
  const foodCuisines = healthy ? cuisines.filter((id) => !HEALTHY_FOODS.has(id)) : cuisines

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
  // "quick lunch" is about speed (see quick), not a deal.
  const lunchSpecial = /\blunch(?:time)?\s+(?:specials?|deals?|combos?|menu|prix[-\s]?fixe|plates?)\b|\b(?:cheap|business)\s+lunch\b/.test(text)
  const lunch = lunchSpecial || /\blunch\b/.test(text)

  let keyword = brand ?? ''
  if (!brand && !foodCuisines.length && !healthy) {
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
    healthyAvoid: healthy ? healthyAvoid : [],
    quick,
    location,
    nearMe: nearMe && !location,
    maxMiles,
    priceLevels,
    openNow,
    lunchSpecial,
    lunch,
    keyword,
    brand,
    placeGuess,
  }
}

/** Put an unresolved place guess back where it came from: the keyword ("birria", not a town). */
export function withoutPlaceGuess(parsed: ParsedQuery): ParsedQuery {
  if (!parsed.placeGuess) return parsed
  const keyword = parsed.brand || parsed.healthy || parsed.cuisines.length ? parsed.keyword : [parsed.keyword, parsed.placeGuess].filter(Boolean).join(' ')
  return { ...parsed, keyword, placeGuess: null }
}

/** Hunt4Food's default kind of healthy: clean kitchens (and clean juice bars). */
export const DEFAULT_HEALTHY_FOCUS: HealthyFocusId[] = ['clean']

/** Plain "healthy" (no kind, dish, brand or other food named) starts with Clean kitchens selected. */
export function withDefaultHealthyFocus(parsed: ParsedQuery): ParsedQuery {
  if (!parsed.healthy || parsed.healthyFocus.length || parsed.brand || parsed.keyword || parsed.cuisines.length) return parsed
  return { ...parsed, healthyFocus: [...DEFAULT_HEALTHY_FOCUS] }
}

/** Short human summary of what was understood, for the confirmation line. */
export function describeParsedQuery(parsed: ParsedQuery, cuisineLabel: (id: CuisineId) => string): string[] {
  const parts: string[] = []
  if (parsed.healthy) parts.push(parsed.quick ? 'Healthy & clean, quick' : 'Healthy & clean')
  else if (parsed.quick) parts.push('Quick')
  const FOCUS_LABELS: Record<HealthyFocusId, string> = {
    seafood: 'salmon & seafood',
    smoothie: 'smoothies & bowls',
    steak: 'steak',
    plant: 'plant-forward',
    clean: 'clean kitchens',
  }
  if (!parsed.brand) parts.push(...(parsed.healthyFocus ?? []).map((id) => FOCUS_LABELS[id]))
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
  const AVOID_LABELS: Record<HealthyFocusId, string> = { smoothie: 'smoothies', steak: 'steakhouses', seafood: 'seafood', plant: 'salad spots', clean: '' }
  for (const id of parsed.healthyAvoid ?? []) parts.push(`no ${AVOID_LABELS[id]}`)
  if (parsed.lunchSpecial) parts.push('lunch special')
  else if (parsed.lunch) parts.push('open for lunch')
  if (parsed.openNow) parts.push('open now')
  return parts
}
