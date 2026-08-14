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

  if (typeof raw === 'number') {
    // Google enum: 0=unspecified, 1=free, 2=inexpensive, 3=moderate, 4=expensive, 5=very expensive
    if (raw === 0 || raw === 1) return null
    if (raw >= 2 && raw <= 5) return (raw - 1) as PriceLevel
    return null
  }

  const s = String(raw).toUpperCase()
  if (s.includes('UNSPECIFIED')) return null
  if (s.includes('FREE')) return null
  if (s.includes('INEXPENSIVE')) return 1
  if (s.includes('MODERATE')) return 2
  if (s.includes('VERY_EXPENSIVE') || s.includes('VERY EXPENSIVE')) return 4
  if (s.includes('EXPENSIVE')) return 3
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
