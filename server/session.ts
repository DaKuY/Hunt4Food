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
  | { type: 'unavailable' }

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

// Cache confirmed lodge answers for the short burst of HTML/API requests one
// launch generates. Logged-out answers and outages are never cached, so a
// revoked session or grant takes effect within LODGE_CACHE_TTL_MS.
export const LODGE_CACHE_TTL_MS = 15_000
const LODGE_CACHE_MAX = 500

export function createLodgeSessionCache(
  lookup: (lodgeOrigin: string, token: string) => Promise<LodgeLookup> = fetchLodgeSession,
  { ttlMs = LODGE_CACHE_TTL_MS, max = LODGE_CACHE_MAX, now = Date.now } = {},
): (lodgeOrigin: string, token: string) => Promise<LodgeLookup> {
  const answers = new Map<string, { answer: SessionPayload; expires: number }>()
  const pending = new Map<string, Promise<LodgeLookup>>()
  return (lodgeOrigin, token) => {
    const key = `${lodgeOrigin}|${token}`
    const hit = answers.get(key)
    if (hit && hit.expires > now()) return Promise.resolve(hit.answer)
    if (hit) answers.delete(key)
    const inFlight = pending.get(key)
    if (inFlight) return inFlight
    const request = lookup(lodgeOrigin, token)
      .then((answer) => {
        if (answer !== 'unauthorized' && answer !== 'unavailable') {
          if (answers.size >= max) answers.delete(answers.keys().next().value!)
          answers.set(key, { answer, expires: now() + ttlMs })
        }
        return answer
      })
      .finally(() => pending.delete(key))
    pending.set(key, request)
    return request
  }
}

const cachedLodgeSession = createLodgeSessionCache()

/**
 * Base Camp is the only verifier: a confirmed session is allowed, a logged-out
 * answer goes to login, and an outage fails closed (503) without a login loop.
 * Hunt4Food is open to every signed-in Base Camp member; no grant is required.
 */
export async function authorizeRequest(
  cookieHeader: string | null | undefined,
  lodgeOrigin: string,
  deps: AuthorizeDeps = {},
): Promise<GateDecision> {
  const token = readCookie(cookieHeader, SESSION_COOKIE)
  if (!token) return { type: 'login' }

  const lodge = await (deps.fetchLodge ?? ((t) => cachedLodgeSession(lodgeOrigin, t)))(token)
  if (lodge === 'unauthorized') return { type: 'login' }
  if (lodge === 'unavailable') return { type: 'unavailable' }
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
