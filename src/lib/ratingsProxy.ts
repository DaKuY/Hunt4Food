import { loadSettings } from './settings'

/** Deployed Apps Script web app (public — not a secret). Override via Settings or env. */
export const BUILTIN_RATINGS_PROXY_URL =
  'https://script.google.com/macros/s/AKfycbwTuIEJasIVE2eXy1SPXTQHazFXhLOUlJWoiY3P22OP2okq6NXJDhzTo7bVr3iOXgQs6A/exec'

/**
 * JSONP fetch for Google Apps Script web apps (CORS-safe from GitHub Pages).
 */
export function jsonpGet<T>(baseUrl: string, params: Record<string, string>): Promise<T> {
  const url = new URL(baseUrl)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  return new Promise((resolve, reject) => {
    const cb = `openplate_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Proxy timeout'))
    }, 20000)

    function cleanup() {
      window.clearTimeout(timer)
      delete (window as unknown as Record<string, unknown>)[cb]
      script.remove()
    }

    ;(window as unknown as Record<string, unknown>)[cb] = (data: T) => {
      cleanup()
      resolve(data)
    }

    url.searchParams.set('callback', cb)
    script.src = url.toString()
    script.onerror = () => {
      cleanup()
      reject(new Error('Proxy request failed'))
    }
    document.head.appendChild(script)
  })
}

export function ratingsProxyUrl(): string {
  const settings = loadSettings()
  return (
    settings.ratingsProxyUrl ||
    (import.meta.env.VITE_RATINGS_PROXY_URL as string | undefined) ||
    BUILTIN_RATINGS_PROXY_URL
  )
}

export function ratingsProxyConfigured(): boolean {
  return Boolean(ratingsProxyUrl())
}
