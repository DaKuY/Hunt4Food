import type { CitySelection } from './types'

/** Where the search area came from. */
export type AreaKind =
  /** The phone's location, found this visit. */
  | 'here'
  /** Picked on the map, typed ("near Plano") or opened from a shared link: searches stay there. */
  | 'chosen'
  /** The last area from an earlier visit, used only because the phone's location was unavailable. */
  | 'saved'

/** A new phone fix this close to the current area keeps it, and the places already fetched for it. */
export const SAME_AREA_METERS = 1500
/** A phone fix this recent is reused rather than asking the phone again. */
export const FRESH_FIX_MS = 2 * 60 * 1000

export type PhoneFix =
  | { ok: true; lat: number; lon: number }
  | { ok: false; reason: 'denied' | 'unavailable' | 'unsupported' }

type Point = { lat: number; lon: number }

export function distanceMeters(a: Point, b: Point): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * A search with no place typed ("healthy", "salmon") runs where the phone is now,
 * unless the person chose an area. "near me" always means the phone's location.
 */
export function wantsPhoneLocation(kind: AreaKind | null, nearMe: boolean): boolean {
  return nearMe || kind !== 'chosen'
}

/** Ask the phone again unless its last fix is fresh. */
export function needsNewFix(lastFixAt: number | null, now: number): boolean {
  return lastFixAt === null || now - lastFixAt > FRESH_FIX_MS
}

/** Keep the current area when the phone is still inside it. */
export function stillInArea(kind: AreaKind | null, area: CitySelection | null, fix: Point): boolean {
  return kind === 'here' && area !== null && distanceMeters(area.center, fix) < SAME_AREA_METERS
}

/** What to tell someone whose phone location didn't come through. */
export function locationProblem(reason: Exclude<PhoneFix, { ok: true }>['reason']): string {
  if (reason === 'denied') {
    return 'Location is off for this site. On iPhone: Settings › Privacy & Security › Location Services › Safari Websites › While Using. Or add “near <city>”.'
  }
  if (reason === 'unsupported') return 'This browser can’t share your location. Add “near <city>” or choose an area.'
  return 'Couldn’t get your location. Try again, or add “near <city>”.'
}

type PhotonPlace = {
  name?: string
  city?: string
  district?: string
  county?: string
  state?: string
  country?: string
  type?: string
}

const PLACE_TYPES = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'district', 'locality'])

/**
 * A town for a reverse-geocoded point: Photon answers with the nearest feature, which is
 * usually a street or a building ("West Bethel Road"), so name the town it is in.
 */
export function townLabel(p: PhotonPlace): string | null {
  const town = p.city || (p.type && PLACE_TYPES.has(p.type) ? p.name : undefined) || p.district || p.county || p.name
  const parts = [town, p.state, p.country].filter((v): v is string => Boolean(v && v.trim()))
  return parts.filter((v, i) => parts.indexOf(v) === i).join(', ') || null
}
