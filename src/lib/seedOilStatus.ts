import { signalSourceLabel } from './healthySignals'
import type { SeedOilInfo } from './seedOil'
import type { HealthySignal, Restaurant } from './types'

/**
 * Honest answer to "doesn't have seed oils". Most restaurants never publish
 * their cooking oil, so "unknown" is the common case and is shown as such,
 * never passed off as seed-oil free.
 */
export type SeedOilVerdict = {
  status: 'free' | 'uses' | 'unknown'
  /** Short, user-facing evidence, e.g. "Seed Oil Tracker grade A" or "Yelp review: cooks with lard". */
  evidence: string | null
}

/** Explicit statements that a place cooks with seed oils. */
const USES_SEED_OILS =
  /\b(?:fried|fries|frying|cooked|cooks|cook|made)\s+(?:\w+\s+){0,2}in\s+(?:canola|vegetable|soybean|corn|cottonseed|sunflower|safflower|rapeseed|seed)\s+oil\b|\buses?\s+(?:canola|vegetable|soybean|seed)\s+oils?\b/i

const FREE_SIGNAL_LABELS: Partial<Record<HealthySignal['id'], string>> = {
  no_seed_oils: 'no seed oils',
  tallow: 'cooks with tallow or lard',
  avocado_oil: 'cooks with avocado oil',
}

export function seedOilVerdict(
  place: Restaurant & { signals?: HealthySignal[]; evidenceText?: string },
  info: SeedOilInfo | null | undefined,
): SeedOilVerdict {
  const grade = info?.grade?.toUpperCase() ?? null
  if (grade === 'D' || grade === 'F') {
    return { status: 'uses', evidence: `Seed Oil Tracker grade ${grade}${info?.cookingOil ? ` — ${info.cookingOil}` : ''}` }
  }
  if (place.evidenceText && USES_SEED_OILS.test(place.evidenceText)) {
    return { status: 'uses', evidence: 'A review says it cooks with seed oil' }
  }
  if (grade === 'A' || grade === 'B') {
    return { status: 'free', evidence: `Seed Oil Tracker grade ${grade}${info?.cookingOil ? ` — ${info.cookingOil}` : ''}` }
  }
  const signal = (place.signals ?? []).find((s) => FREE_SIGNAL_LABELS[s.id])
  if (signal) {
    const where = signal.source === 'listing' ? 'Listing' : signalSourceLabel(signal.source)
    return { status: 'free', evidence: `${where}: ${FREE_SIGNAL_LABELS[signal.id]}` }
  }
  return { status: 'unknown', evidence: null }
}

/**
 * For a "no seed oils" search: drop places known to use them, and list verified
 * seed-oil-free places first, keeping the existing order within each group.
 */
export function applySeedOilRequirement<T extends Restaurant & { signals?: HealthySignal[]; evidenceText?: string }>(
  places: T[],
  infoById: Record<string, SeedOilInfo | undefined>,
): T[] {
  const withVerdict = places.map((place) => ({ place, verdict: seedOilVerdict(place, infoById[place.id]) }))
  return [
    ...withVerdict.filter((row) => row.verdict.status === 'free'),
    ...withVerdict.filter((row) => row.verdict.status === 'unknown'),
  ].map((row) => row.place)
}
