import type { Restaurant } from './types'

/**
 * "With a lunch special." No data source has a lunch-special flag, so this is
 * evidence-based like the seed-oil check: review, snippet or listing text that
 * mentions a lunch special counts as verified; opening hours that never cover
 * midday rule a place out; everything else is "not verified".
 */
export type LunchVerdict = {
  status: 'special' | 'no_lunch' | 'unknown'
  /** Quote or reason shown on the card. */
  evidence: string | null
  /** e.g. "11:00–15:00" when the hours show lunch service. */
  lunchHours: string | null
}

const LUNCH_SPECIAL =
  /\blunch(?:time)?\s+(?:specials?|deals?|combos?|menus?|plates?|prix[-\s]?fixe|boxes?|bento|bowls? special|portions?|pricing|prices?)\b|\b(?:weekday|daily|business|express)\s+lunch\b|\$\s?\d{1,2}(?:\.\d{2})?\s+lunch\b|\blunch\s+(?:for|is|was|at)\s+(?:only\s+)?\$\s?\d{1,2}|\blunch\s+(?:hours?\s+)?(?:from|until|til|between)\s+\d/i

const NEGATED = /\b(?:no|not|never|without|don'?t|doesn'?t|stopped|discontinued|no longer)\b[^.!?]{0,30}$/i

/** Quote the sentence around the first non-negated lunch-special mention. */
export function findLunchSpecial(text: string | null | undefined): string | null {
  if (!text) return null
  const re = new RegExp(LUNCH_SPECIAL.source, 'gi')
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0
    if (NEGATED.test(text.slice(Math.max(0, index - 40), index))) continue
    const start = Math.max(0, text.lastIndexOf('.', index) + 1)
    const endDot = text.indexOf('.', index + match[0].length)
    const end = endDot === -1 ? Math.min(text.length, index + 140) : Math.min(endDot + 1, index + 160)
    return text.slice(start, end).replace(/\s+/g, ' ').trim()
  }
  return null
}

const DAY = '(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)'
const RANGE = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g

/**
 * Does an OSM opening_hours string show service over lunch (open by 12:00 and
 * until at least 13:30 on some day)? null when the format isn't understood.
 */
export function lunchServiceHours(openingHours: string | undefined): { serves: boolean; hours: string | null } | null {
  if (!openingHours) return null
  if (/24\/7/.test(openingHours)) return { serves: true, hours: 'open 24/7' }
  if (!new RegExp(`${DAY}|\\d{1,2}:\\d{2}`).test(openingHours)) return null
  const ranges = [...openingHours.matchAll(RANGE)].map((m) => ({
    open: Number(m[1]) * 60 + Number(m[2]),
    close: Number(m[3]) * 60 + Number(m[4]) || 24 * 60,
    text: `${m[1].padStart(2, '0')}:${m[2]}–${m[3].padStart(2, '0')}:${m[4]}`,
  }))
  if (!ranges.length) return null
  const lunch = ranges.find((r) => r.open <= 12 * 60 && (r.close >= 13 * 60 + 30 || r.close < r.open))
  return lunch ? { serves: true, hours: lunch.text } : { serves: false, hours: null }
}

export function lunchVerdict(place: Restaurant & { evidenceText?: string }): LunchVerdict {
  const hours = lunchServiceHours(place.openingHours)
  if (hours && !hours.serves) return { status: 'no_lunch', evidence: 'Hours show no lunch service', lunchHours: null }
  const quote = findLunchSpecial(place.evidenceText)
  if (quote) return { status: 'special', evidence: `“${quote}”`, lunchHours: hours?.hours ?? null }
  return { status: 'unknown', evidence: null, lunchHours: hours?.hours ?? null }
}
