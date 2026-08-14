import { readJson, writeJson } from './storage'

export type AppSettings = {
  googlePlacesApiKey: string
  ratingsProxyUrl: string
}

const KEY = 'settings'

export function loadSettings(): AppSettings {
  const fromStorage = readJson<Partial<AppSettings>>(KEY, {})
  const googleFromEnv = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined
  const proxyFromEnv = import.meta.env.VITE_RATINGS_PROXY_URL as string | undefined
  return {
    googlePlacesApiKey: fromStorage.googlePlacesApiKey || googleFromEnv || '',
    ratingsProxyUrl: fromStorage.ratingsProxyUrl || proxyFromEnv || '',
  }
}

export function saveSettings(settings: AppSettings): void {
  writeJson(KEY, settings)
}
