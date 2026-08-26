/**
 * Ratings now go through the authenticated same-origin Vercel API.
 * The browser never receives the Apps Script URL or server-side proxy secret.
 */
export const BUILTIN_RATINGS_PROXY_URL = '/api/ratings'

export async function jsonpGet<T>(
  _baseUrl: string,
  params: Record<string, string>,
  timeoutMs = 10000,
): Promise<T> {
  const url = new URL('/api/ratings', window.location.origin)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Ratings proxy HTTP ${response.status}`)
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timer)
  }
}

export function ratingsProxyUrl(): string {
  return BUILTIN_RATINGS_PROXY_URL
}

export function ratingsProxyConfigured(): boolean {
  return true
}
