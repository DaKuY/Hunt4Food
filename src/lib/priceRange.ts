/** Normalized 1–4 scale ($ to $$$$). */
export type PriceLevel = 1 | 2 | 3 | 4

export type PriceRange = {
  level: PriceLevel | null
  label: string | null
  source: 'google' | 'yelp' | null
}

const LABELS: Record<PriceLevel, string> = {
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
}

/** Google Places priceLevel enum → 1–4 */
export function googlePriceLevel(raw?: string | number | null): PriceLevel | null {
  if (raw == null) return null
  if (typeof raw === 'number' && raw >= 1 && raw <= 4) return raw as PriceLevel
  const s = String(raw).toUpperCase()
  if (s.includes('INEXPENSIVE') || s === 'PRICE_LEVEL_INEXPENSIVE') return 1
  if (s.includes('MODERATE') || s === 'PRICE_LEVEL_MODERATE') return 2
  if (s.includes('EXPENSIVE') && !s.includes('VERY')) return 3
  if (s.includes('VERY_EXPENSIVE') || s.includes('VERY EXPENSIVE')) return 4
  if (s === 'FREE' || s.includes('PRICE_LEVEL_FREE')) return 1
  return null
}

/** Yelp "$$" style → 1–4 */
export function yelpPriceLevel(raw?: string | null): PriceLevel | null {
  if (!raw) return null
  const n = raw.replace(/[^$]/g, '').length
  if (n >= 1 && n <= 4) return n as PriceLevel
  return null
}

export function priceLabel(level: PriceLevel | null): string | null {
  if (level == null) return null
  return LABELS[level]
}

export function mergePrice(google?: PriceLevel | null, yelp?: PriceLevel | null): PriceRange {
  if (google != null) {
    return { level: google, label: priceLabel(google), source: 'google' }
  }
  if (yelp != null) {
    return { level: yelp, label: priceLabel(yelp), source: 'yelp' }
  }
  return { level: null, label: null, source: null }
}
