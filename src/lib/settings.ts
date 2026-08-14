import { readJson, writeJson } from './storage'

export type AppSettings = {
  googlePlacesApiKey: string
}

const KEY = 'settings'

export function loadSettings(): AppSettings {
  const fromStorage = readJson<Partial<AppSettings>>(KEY, {})
  const fromEnv = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined
  return {
    googlePlacesApiKey: fromStorage.googlePlacesApiKey || fromEnv || '',
  }
}

export function saveSettings(settings: AppSettings): void {
  writeJson(KEY, settings)
}
