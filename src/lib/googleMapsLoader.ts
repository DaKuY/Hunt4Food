import { loadSettings } from './settings'

/**
 * Google Maps (Maps JavaScript API) for the area picker and results map.
 *
 * Cost: map loads are the "Dynamic Maps" Essentials SKU — 10,000 free per month, then
 * $7 per 1,000 (developers.google.com/maps/billing-and-pricing/pricing). Hunt4Food loads a
 * map only on the area picker and the results list, so personal use stays free.
 *
 * Key: VITE_GOOGLE_MAPS_API_KEY (browser key restricted to https://hunt4food.andrewcamero.com/*
 * and to the Maps JavaScript API), else the browser Places key (VITE_GOOGLE_PLACES_API_KEY or
 * the Settings override) if Maps JavaScript API is enabled on it. With no key, or if Google
 * refuses it, the app shows the keyless Google Maps embed (GoogleEmbedMap) — never OpenStreetMap.
 */
export function googleMapsKey(): string {
  const env = import.meta.env as Record<string, string | undefined>
  return (env.VITE_GOOGLE_MAPS_API_KEY || env.VITE_GOOGLE_PLACES_API_KEY || loadSettings().googlePlacesApiKey || '').trim()
}

/** Keyless maps.google.com embed URL for a place, a search, or just the area. */
export function googleEmbedUrl(center: { lat: number; lon: number }, zoom: number, query?: string): string {
  const params = new URLSearchParams({
    q: query?.trim() || `${center.lat.toFixed(5)},${center.lon.toFixed(5)}`,
    ll: `${center.lat.toFixed(5)},${center.lon.toFixed(5)}`,
    z: String(Math.max(3, Math.min(18, Math.round(zoom)))),
    output: 'embed',
  })
  return `https://maps.google.com/maps?${params}`
}

/** Advanced markers need a map ID; create one (free) in Cloud Console → Map Management. */
export function googleMapId(): string {
  const env = import.meta.env as Record<string, string | undefined>
  return (env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID').trim()
}

export type GoogleMapsLibs = {
  maps: google.maps.MapsLibrary
  marker: google.maps.MarkerLibrary
}

let loading: Promise<GoogleMapsLibs> | null = null
let authFailed = false
const authFailureListeners = new Set<() => void>()

/**
 * Google checks the key when a map is created, after the script has loaded, and then calls
 * window.gm_authFailure and paints "Oops! Something went wrong" over the map. Maps subscribe
 * here so every one on the page switches to the OpenStreetMap fallback.
 */
export function onGoogleMapsAuthFailure(listener: () => void): () => void {
  if (authFailed) {
    listener()
    return () => {}
  }
  authFailureListeners.add(listener)
  return () => authFailureListeners.delete(listener)
}

/** False once Google refused the key this session: go straight to the fallback map. */
export function googleMapsUsable(): boolean {
  return !authFailed && Boolean(googleMapsKey())
}

function markAuthFailed() {
  authFailed = true
  for (const listener of Array.from(authFailureListeners)) listener()
  authFailureListeners.clear()
}

const CALLBACK = '__hunt4foodGoogleMapsReady'
const LOAD_TIMEOUT_MS = 10_000

/** Loads the Maps JavaScript API once; rejects (so callers fall back) on a missing key or failure. */
export function loadGoogleMaps(): Promise<GoogleMapsLibs> {
  if (authFailed) return Promise.reject(new Error('Google Maps key was refused'))
  if (loading) return loading
  const key = googleMapsKey()
  if (!key) return Promise.reject(new Error('No Google Maps key'))

  loading = new Promise<void>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>
    const timer = window.setTimeout(() => reject(new Error('Google Maps timed out')), LOAD_TIMEOUT_MS)
    w[CALLBACK] = () => {
      window.clearTimeout(timer)
      resolve()
    }
    // A bad or unauthorized key calls this instead of failing the script load.
    w.gm_authFailure = () => {
      window.clearTimeout(timer)
      markAuthFailed()
      reject(new Error('Google Maps key was refused'))
    }
    const script = document.createElement('script')
    const params = new URLSearchParams({ key, v: 'weekly', loading: 'async', callback: CALLBACK })
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('Google Maps failed to load'))
    }
    document.head.append(script)
  })
    .then(async () => ({
      maps: (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary,
      marker: (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary,
    }))
    .catch((error: unknown) => {
      loading = null
      throw error
    })
  return loading
}

/** Opens directions in the Google Maps app on iPhone (or Google Maps in the browser). */
export function directionsUrl(place: { lat: number; lon: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.lat},${place.lon}`)}`
}
