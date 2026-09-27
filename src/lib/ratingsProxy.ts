import { loadSettings } from './settings'

/** Deployed Apps Script web app (public — not a secret). Override via Settings or env. */
export const BUILTIN_RATINGS_PROXY_URL =
  'https://script.google.com/macros/s/AKfycbwTuIEJasIVE2eXy1SPXTQHazFXhLOUlJWoiY3P22OP2okq6NXJDhzTo7bVr3iOXgQs6A/exec'

const APPS_SCRIPT_EXEC = /^https:\/\/script\.google\.com\/(?:a\/[^/?#]+\/)?macros\/s\/[\w-]+\/exec$/

/**
 * JSONP runs the response as a script in this origin, so only Google Apps Script
 * web-app URLs are allowed as proxies (never an arbitrary pasted URL).
 */
export function isAllowedProxyUrl(value: string): boolean {
  return APPS_SCRIPT_EXEC.test(value.trim())
}

/**
 * JSONP fetch for Google Apps Script web apps (CORS-safe from GitHub Pages).
 */
export function jsonpGet<T>(
  baseUrl: string,
  params: Record<string, string>,
  timeoutMs = 10000,
): Promise<T> {
  if (!isAllowedProxyUrl(baseUrl)) {
    return Promise.reject(new Error('Proxy URL must be a Google Apps Script /exec URL'))
  }
  const url = new URL(baseUrl.trim())
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  return new Promise((resolve, reject) => {
    const cb = `openplate_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Proxy timeout'))
    }, timeoutMs)

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
  const candidates = [
    settings.ratingsProxyUrl,
    import.meta.env.VITE_RATINGS_PROXY_URL as string | undefined,
  ]
  return candidates.find((url) => url && isAllowedProxyUrl(url))?.trim() ?? BUILTIN_RATINGS_PROXY_URL
}

export function ratingsProxyConfigured(): boolean {
  return Boolean(ratingsProxyUrl())
}
