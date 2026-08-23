import type {
  HealthyLane,
  HealthySignal,
  HealthySignalId,
  HealthySignalSource,
  Restaurant,
} from './types'

export const HEALTHY_LANE_LABELS: Record<HealthyLane, string> = {
  clean_cooking: 'Clean cooking',
  smoothie: 'Smoothie shops',
  protein: 'Healthy salmon & chicken',
}

export const HEALTHY_SIGNAL_DEFS: Array<{
  id: HealthySignalId
  label: string
  patterns: RegExp[]
}> = [
  { id: 'grass_fed', label: 'Grass-fed', patterns: [/grass[-\s]?fed/i] },
  {
    id: 'pasture_raised',
    label: 'Pasture-raised',
    patterns: [/pasture[-\s]?raised/i, /pastured\s+(chicken|eggs?)/i],
  },
  {
    id: 'no_seed_oils',
    label: 'No seed oils',
    patterns: [/no seed oils?/i, /seed[-\s]?oil[-\s]?free/i, /doesn'?t use seed oil/i],
  },
  { id: 'avocado_oil', label: 'Avocado oil', patterns: [/avocado oil/i] },
  {
    id: 'butter',
    label: 'Cooks with butter',
    patterns: [/cooked? in butter/i, /grass[-\s]?fed butter/i, /\bghee\b/i, /clarified butter/i],
  },
  { id: 'salmon', label: 'Salmon', patterns: [/\bsalmon\b/i] },
  { id: 'chicken_breast', label: 'Chicken breast', patterns: [/chicken breast/i, /grilled chicken/i] },
  {
    id: 'smoothie',
    label: 'Smoothies',
    patterns: [/smoothie/i, /açaí/i, /acai/i, /cold[-\s]?pressed/i],
  },
]

export type KnownHealthyChain = {
  name: string
  lane: HealthyLane
  aliases: string[]
}

export const KNOWN_HEALTHY_CHAINS: KnownHealthyChain[] = [
  { name: 'True Food Kitchen', lane: 'clean_cooking', aliases: ['true food'] },
  { name: 'Flower Child', lane: 'clean_cooking', aliases: ['flower child'] },
  { name: 'Sweetgreen', lane: 'clean_cooking', aliases: ['sweetgreen', 'sweet green'] },
  { name: 'Cava', lane: 'clean_cooking', aliases: ['cava'] },
  { name: 'Chopt', lane: 'clean_cooking', aliases: ['chopt'] },
  { name: 'Tender Greens', lane: 'clean_cooking', aliases: ['tender greens'] },
  { name: 'Just Salad', lane: 'clean_cooking', aliases: ['just salad'] },
  { name: 'Honeygrow', lane: 'clean_cooking', aliases: ['honeygrow'] },
  { name: 'Freshii', lane: 'clean_cooking', aliases: ['freshii'] },
  { name: 'Dig Inn', lane: 'clean_cooking', aliases: ['dig inn'] },
  { name: 'Lyfe Kitchen', lane: 'clean_cooking', aliases: ['lyfe kitchen'] },
  { name: 'Tropical Smoothie Cafe', lane: 'smoothie', aliases: ['tropical smoothie'] },
  { name: 'Pure Green', lane: 'smoothie', aliases: ['pure green'] },
  { name: 'Smoothie King', lane: 'smoothie', aliases: ['smoothie king'] },
  { name: 'Juice Press', lane: 'smoothie', aliases: ['juice press'] },
  { name: 'Clean Juice', lane: 'smoothie', aliases: ['clean juice'] },
  { name: 'Robeks', lane: 'smoothie', aliases: ['robeks'] },
  { name: 'Jamba', lane: 'smoothie', aliases: ['jamba', 'jamba juice'] },
  { name: 'Playa Bowls', lane: 'smoothie', aliases: ['playa bowls'] },
]

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function matchKnownChain(place: Restaurant): KnownHealthyChain | null {
  const name = normalizeName(place.name)
  if (!name) return null
  for (const chain of KNOWN_HEALTHY_CHAINS) {
    if (chain.aliases.some((alias) => name.includes(alias) || alias.includes(name))) {
      return chain
    }
  }
  return null
}

export function listingBlob(place: Restaurant, extra = ''): string {
  return `${place.name} ${place.cuisineRaw ?? ''} ${place.cuisines.join(' ')} ${place.amenity ?? ''} ${place.address ?? ''} ${extra}`
}

function sourceFromHint(hint?: HealthySignalSource): HealthySignalSource {
  return hint ?? 'listing'
}

export function extractHealthySignals(
  text: string,
  source: HealthySignalSource = 'listing',
): HealthySignal[] {
  if (!text.trim()) return []
  const found: HealthySignal[] = []
  for (const def of HEALTHY_SIGNAL_DEFS) {
    const hit = def.patterns.find((p) => p.test(text))
    if (!hit) continue
    const match = text.match(hit)
    let quote: string | undefined
    if (match?.index != null) {
      const start = Math.max(0, match.index - 50)
      const end = Math.min(text.length, match.index + match[0].length + 70)
      quote = text.slice(start, end).replace(/\s+/g, ' ').trim()
    }
    found.push({ id: def.id, label: def.label, source, quote })
  }
  return found
}

export function mergeSignals(existing: HealthySignal[], incoming: HealthySignal[]): HealthySignal[] {
  const out = [...existing]
  for (const sig of incoming) {
    const prev = out.find((s) => s.id === sig.id)
    if (!prev) {
      out.push(sig)
      continue
    }
    if (!prev.quote && sig.quote) prev.quote = sig.quote
    if (prev.source === 'listing' && sig.source !== 'listing') prev.source = sig.source
  }
  return out
}

export function assignHealthyLane(
  place: Restaurant,
  signals: HealthySignal[],
  hint?: HealthyLane | null,
): HealthyLane {
  if (hint) return hint
  const chain = matchKnownChain(place)
  if (chain) return chain.lane

  const ids = new Set(signals.map((s) => s.id))
  if (ids.has('smoothie') && !ids.has('grass_fed') && !ids.has('avocado_oil')) return 'smoothie'
  if (ids.has('grass_fed') || ids.has('pasture_raised') || ids.has('avocado_oil') || ids.has('no_seed_oils')) {
    return 'clean_cooking'
  }
  if (ids.has('salmon') || ids.has('chicken_breast')) return 'protein'

  const blob = listingBlob(place).toLowerCase()
  if (/smoothie|juice|açaí|acai/.test(blob)) return 'smoothie'
  if (/salmon|chicken|poke|seafood/.test(blob)) return 'protein'
  return 'clean_cooking'
}

export function healthyInstantBoost(place: Restaurant): {
  points: number
  reasons: string[]
  lane: HealthyLane
  signals: HealthySignal[]
} {
  const chain = matchKnownChain(place)
  const signals = extractHealthySignals(listingBlob(place), sourceFromHint('listing'))
  const lane = assignHealthyLane(place, signals, chain?.lane)
  let points = signals.length * 6
  const reasons: string[] = []
  if (chain) {
    points += 22
    reasons.push(`Similar to ${chain.name}`)
  }
  if (signals.length) {
    reasons.push(`Listing mentions ${signals.map((s) => s.label.toLowerCase()).slice(0, 3).join(', ')}`)
  }
  return { points, reasons, lane, signals }
}

export function signalSourceLabel(source: HealthySignalSource): string {
  switch (source) {
    case 'yelp_review':
      return 'Yelp review'
    case 'google_snippet':
      return 'Google snippet'
    case 'opentable':
      return 'OpenTable'
    case 'tripadvisor':
      return 'TripAdvisor'
    case 'seed_oil':
      return 'Seed Oil Tracker'
    default:
      return 'Listing'
  }
}

export function evidenceLine(signals: HealthySignal[]): string | undefined {
  const quoted = signals.find((s) => s.quote && s.source !== 'listing')
  if (quoted?.quote) {
    return `${signalSourceLabel(quoted.source)}: “${quoted.quote}”`
  }
  const mentioned = signals.filter((s) => s.source !== 'listing')
  if (mentioned.length) {
    const src = signalSourceLabel(mentioned[0]!.source)
    return `${src}s mention ${mentioned.map((s) => s.label.toLowerCase()).slice(0, 3).join(', ')}.`
  }
  if (signals.length) {
    return `Mentioned in listings: ${signals.map((s) => s.label.toLowerCase()).slice(0, 3).join(', ')}.`
  }
  return undefined
}
