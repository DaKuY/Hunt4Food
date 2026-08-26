import {
  hasAppGrant,
  parseSessionPayload,
  readCookie,
  SESSION_COOKIE,
  type SessionPayload,
} from './token.js'

export type LodgeLookup = 'unauthorized' | 'unavailable' | SessionPayload

export type AuthorizeDeps = {
  fetchLodge?: (token: string) => Promise<LodgeLookup>
}

export type GateDecision =
  | { type: 'allow'; session: SessionPayload }
  | { type: 'login' }

export { hasAppGrant }

export function sessionFromUnknown(data: unknown): SessionPayload | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (record.authenticated === false) return null
  if ('user' in record) {
    if (!record.user || typeof record.user !== 'object') return null
    return parseSessionPayload(record.user as Record<string, unknown>)
  }
  const nested = record.session ?? record
  if (!nested || typeof nested !== 'object') return null
  return parseSessionPayload(nested as Record<string, unknown>)
}

export async function fetchLodgeSession(
  lodgeOrigin: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LodgeLookup> {
  try {
    const res = await fetchImpl(`${lodgeOrigin}/api/session`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    })
    if (res.status === 401 || res.status === 403) return 'unauthorized'
    if (!res.ok) return 'unavailable'
    const data: unknown = await res.json()
    if (data && typeof data === 'object' && (data as { user?: unknown }).user === null) {
      return 'unauthorized'
    }
    if (data && typeof data === 'object' && (data as { authenticated?: unknown }).authenticated === false) {
      return 'unauthorized'
    }
    const session = sessionFromUnknown(data)
    if (!session) return 'unavailable'
    return session
  } catch {
    return 'unavailable'
  }
}

export async function authorizeRequest(
  cookieHeader: string | null | undefined,
  lodgeOrigin: string,
  deps: AuthorizeDeps = {},
): Promise<GateDecision> {
  const token = readCookie(cookieHeader, SESSION_COOKIE)
  if (!token) return { type: 'login' }

  const lodge = await (deps.fetchLodge ?? ((t) => fetchLodgeSession(lodgeOrigin, t)))(token)
  if (lodge === 'unauthorized' || lodge === 'unavailable') {
    // Fail closed: no stale/local JWT fallback.
    return { type: 'login' }
  }
  return { type: 'allow', session: lodge }
}

export function requestWantsJson(request: Request): boolean {
  const path = new URL(request.url).pathname
  if (path === '/api' || path.startsWith('/api/')) return true
  const xhr = request.headers.get('x-requested-with')
  if (xhr && xhr.toLowerCase() === 'xmlhttprequest') return true
  const accept = request.headers.get('accept') ?? ''
  return accept.includes('application/json') && !accept.includes('text/html')
}

export function publicOriginFrom(request: Request): string {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost ?? request.headers.get('host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}`
}
