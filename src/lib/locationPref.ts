import { readJson, writeJson } from './storage'

/** How OpenPlate asks before using device GPS on the city step. */
export type LocationPermissionMode = 'once' | 'ask' | 'always'

const KEY = 'locationPermission'

export function loadLocationPref(): LocationPermissionMode | null {
  const v = readJson<LocationPermissionMode | null>(KEY, null)
  if (v === 'once' || v === 'ask' || v === 'always') return v
  return null
}

export function saveLocationPref(mode: LocationPermissionMode): void {
  writeJson(KEY, mode)
}

export function clearLocationPref(): void {
  try {
    localStorage.removeItem('openplate:' + KEY)
  } catch {
    // ignore
  }
}

export function locationPrefLabel(mode: LocationPermissionMode | null): string {
  if (mode === 'always') return 'Always allow'
  if (mode === 'ask') return 'Ask every time'
  return 'Not set (prompt each visit)'
}
