import { describe, expect, it } from 'vitest'
import { lodgeEnvFrom, loginUrl } from './env.js'
import { handleLodgeGate, isUngatedPath } from './gate.js'
import {
  authorizeRequest,
  createLodgeSessionCache,
  fetchLodgeSession,
  hasAppGrant,
  sessionFromUnknown,
  type LodgeLookup,
} from './session.js'
import { parseSessionPayload, SESSION_COOKIE, type SessionPayload } from './token.js'

const SLUG = 'Hunt4Food'
const LODGE = 'https://andrewcamero.com'
const ORIGIN = 'https://hunt4food.andrewcamero.com'
const ORIGIN_CANONICAL = new URL(ORIGIN).origin
// The cookie is opaque here: only Base Camp can read or verify it.
const TOKEN = 'opaque-base-camp-session'

const env = lodgeEnvFrom({
  COOKIE_DOMAIN: '.andrewcamero.com',
  LODGE_ORIGIN: LODGE,
  APP_SLUG: SLUG,
})

function claims(overrides: Partial<SessionPayload> = {}): SessionPayload {
  const admin = overrides.admin ?? overrides.role === 'admin'
  return {
    id: 'user-1',
    email: 'member@example.com',
    name: 'Member',
    apps: [],
    tokenVersion: 1,
    ...overrides,
    admin,
    role: admin ? 'admin' : 'member',
  }
}

function cookieHeader(token = TOKEN): string {
  return `${SESSION_COOKIE}=${token}`
}

function htmlRequest(cookie?: string): Request {
  const headers = new Headers({ accept: 'text/html' })
  if (cookie) headers.set('cookie', cookie)
  return new Request(`${ORIGIN}/`, { headers })
}

function apiRequest(cookie?: string): Request {
  const headers = new Headers({ accept: 'application/json' })
  if (cookie) headers.set('cookie', cookie)
  return new Request(`${ORIGIN}/api/session`, { headers })
}

const lodgeSays = (answer: LodgeLookup) => ({ fetchLodge: async () => answer })

describe('lodge auth gate', () => {
  it('redirects HTML and 401s APIs when there is no cookie', async () => {
    const html = await handleLodgeGate(htmlRequest(), env)
    expect(html).not.toBeNull()
    expect(html!.status).toBe(302)
    expect(html!.headers.get('location')).toBe(loginUrl(LODGE, ORIGIN_CANONICAL))
    expect(html!.headers.get('location')).toBe(
      'https://andrewcamero.com/login?next=https%3A%2F%2Fhunt4food.andrewcamero.com',
    )

    const api = await handleLodgeGate(apiRequest(), env)
    expect(api).not.toBeNull()
    expect(api!.status).toBe(401)
  })

  it('allows any signed-in member, even without a Hunt4Food grant (deliberate exception)', async () => {
    const session = claims({ apps: [] })
    expect(await authorizeRequest(cookieHeader(), LODGE, lodgeSays(session))).toEqual({ type: 'allow', session })
    expect(await handleLodgeGate(htmlRequest(cookieHeader()), env, lodgeSays(session))).toBeNull()
    expect(await handleLodgeGate(apiRequest(cookieHeader()), env, lodgeSays(session))).toBeNull()
  })

  it('allows a member with Hunt4Food in any casing, and an admin with no grant row', async () => {
    for (const session of [
      claims({ apps: [SLUG] }),
      claims({ apps: ['hunt4food'] }),
      claims({ id: 'admin-1', name: 'Andrew Camero', admin: true, apps: [] }),
    ]) {
      expect((await authorizeRequest(cookieHeader(), LODGE, lodgeSays(session))).type).toBe('allow')
      expect(await handleLodgeGate(htmlRequest(cookieHeader()), env, lodgeSays(session))).toBeNull()
    }
  })

  it('uses the live lodge user, including the current token version', async () => {
    const live = claims({ apps: [], tokenVersion: 9 })
    const decision = await authorizeRequest(cookieHeader(), LODGE, lodgeSays(live))
    expect(decision).toEqual({ type: 'allow', session: live })
  })

  it('sends a revoked or expired session (lodge 401 / user: null) to login', async () => {
    expect(sessionFromUnknown({ user: null })).toBeNull()
    expect((await authorizeRequest(cookieHeader(), LODGE, lodgeSays('unauthorized'))).type).toBe('login')
    const html = await handleLodgeGate(htmlRequest(cookieHeader()), env, lodgeSays('unauthorized'))
    expect(html!.status).toBe(302)
    expect(html!.headers.get('location')).toBe(loginUrl(LODGE, ORIGIN_CANONICAL))
    const api = await handleLodgeGate(apiRequest(cookieHeader()), env, lodgeSays('unauthorized'))
    expect(api!.status).toBe(401)
  })

  it('fails closed with a retryable 503 (never a login redirect) when Base Camp is down', async () => {
    expect((await authorizeRequest(cookieHeader(), LODGE, lodgeSays('unavailable'))).type).toBe('unavailable')
    for (const request of [htmlRequest(cookieHeader()), apiRequest(cookieHeader())]) {
      const response = await handleLodgeGate(request, env, lodgeSays('unavailable'))
      expect(response!.status).toBe(503)
      expect(response!.headers.get('retry-after')).toBe('5')
      expect(response!.headers.get('location')).toBeNull()
    }
  })

  it('forwards only the session cookie to Base Camp with a bounded timeout', async () => {
    let seen: RequestInit | undefined
    let url = ''
    await fetchLodgeSession(LODGE, TOKEN, async (input, init) => {
      url = String(input)
      seen = init
      return new Response(JSON.stringify({ user: claims() }), { status: 200 })
    })
    expect(url).toBe(`${LODGE}/api/session`)
    expect(new Headers(seen?.headers).get('cookie')).toBe(cookieHeader())
    expect(seen?.redirect).toBe('manual')
    expect(seen?.signal).toBeInstanceOf(AbortSignal)
  })

  it('treats a Base Camp 5xx, network error or malformed body as an outage', async () => {
    expect(await fetchLodgeSession(LODGE, TOKEN, async () => new Response('oops', { status: 502 }))).toBe('unavailable')
    expect(
      await fetchLodgeSession(LODGE, TOKEN, async () => {
        throw new Error('offline')
      }),
    ).toBe('unavailable')
    expect(
      await fetchLodgeSession(LODGE, TOKEN, async () => new Response(JSON.stringify({ user: { id: 'x' } }), { status: 200 })),
    ).toBe('unavailable')
  })

  it('parses GET /api/session { user } including admin and apps', () => {
    const session = sessionFromUnknown({
      user: {
        id: 'user-1',
        email: 'member@example.com',
        name: 'Member',
        admin: false,
        role: 'member',
        apps: [SLUG],
        tokenVersion: 2,
      },
    })
    expect(session).toEqual({
      id: 'user-1',
      email: 'member@example.com',
      name: 'Member',
      admin: false,
      role: 'member',
      apps: [SLUG],
      tokenVersion: 2,
    })
    expect(hasAppGrant(session, SLUG)).toBe(true)
  })

  it('maps GET /api/session 200 { user } and 401 { user: null }', async () => {
    const granted = await fetchLodgeSession(LODGE, 'tok', async () => {
      return new Response(
        JSON.stringify({
          user: {
            id: 'user-1',
            email: 'member@example.com',
            name: 'Member',
            admin: false,
            role: 'member',
            apps: [SLUG],
            tokenVersion: 1,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })
    expect(granted).toMatchObject({ id: 'user-1', apps: [SLUG], admin: false })

    const loggedOut = await fetchLodgeSession(LODGE, 'tok', async () => {
      return new Response(JSON.stringify({ user: null }), { status: 401 })
    })
    expect(loggedOut).toBe('unauthorized')

    const nullUser = await fetchLodgeSession(LODGE, 'tok', async () => {
      return new Response(JSON.stringify({ user: null }), { status: 200 })
    })
    expect(nullUser).toBe('unauthorized')
  })

})

describe('createLodgeSessionCache', () => {
  it('reuses a confirmed session and coalesces parallel lookups', async () => {
    let calls = 0
    const lookup = async (): Promise<LodgeLookup> => {
      calls += 1
      return claims({ apps: [SLUG] })
    }
    const cached = createLodgeSessionCache(lookup)
    const [a, b] = await Promise.all([cached(LODGE, 'tok'), cached(LODGE, 'tok')])
    await cached(LODGE, 'tok')
    expect(calls).toBe(1)
    expect(a).toEqual(b)
  })

  it('never caches logouts or outages', async () => {
    const answers: LodgeLookup[] = ['unauthorized', 'unavailable', claims()]
    let calls = 0
    const cached = createLodgeSessionCache(async () => answers[calls++])
    expect(await cached(LODGE, 'tok')).toBe('unauthorized')
    expect(await cached(LODGE, 'tok')).toBe('unavailable')
    expect(typeof (await cached(LODGE, 'tok'))).toBe('object')
    expect(calls).toBe(3)
  })

  it('asks the lodge again once the entry expires', async () => {
    let clock = 0
    let calls = 0
    const cached = createLodgeSessionCache(
      async () => {
        calls += 1
        return claims()
      },
      { ttlMs: 15_000, now: () => clock },
    )
    await cached(LODGE, 'tok')
    clock = 14_999
    await cached(LODGE, 'tok')
    clock = 15_000
    await cached(LODGE, 'tok')
    expect(calls).toBe(2)
  })
})

describe('isUngatedPath', () => {
  it('keeps HTML and APIs gated', () => {
    expect(isUngatedPath('/')).toBe(false)
    expect(isUngatedPath('/index.html')).toBe(false)
    expect(isUngatedPath('/api/session')).toBe(false)
    expect(isUngatedPath('/api/discover.js')).toBe(false)
    expect(isUngatedPath('/api/logo.png')).toBe(false)
  })

  it('skips hashed assets, favicons, and Vite internals', () => {
    expect(isUngatedPath('/assets/index-abc123.js')).toBe(true)
    expect(isUngatedPath('/favicon.svg')).toBe(true)
    expect(isUngatedPath('/hunt4food-logo.svg')).toBe(true)
    expect(isUngatedPath('/logos/7D1A58C5-AFB4-4707-9696-BC085F5048A5.png')).toBe(true)
    expect(isUngatedPath('/.well-known/vercel')).toBe(true)
    expect(isUngatedPath('/src/main.tsx')).toBe(true)
  })

  it('does not authorize static assets (no cookie still served)', async () => {
    const res = await handleLodgeGate(
      new Request(`${ORIGIN}/assets/index-abc.js`, { headers: { accept: '*/*' } }),
      env,
    )
    expect(res).toBeNull()
  })
})

describe('hasAppGrant / parseSessionPayload', () => {
  it('keeps the lodge catalog helper: empty apps denies members', () => {
    expect(hasAppGrant({ admin: false, role: 'member', apps: [] }, SLUG)).toBe(false)
  })

  it('maps canonical claims onto id / role / tokenVersion', () => {
    const parsed = parseSessionPayload({
      sub: 'user-9',
      email: 'a@b.c',
      name: 'A',
      admin: true,
      apps: [],
      tv: 4,
    })
    expect(parsed).toEqual({
      id: 'user-9',
      email: 'a@b.c',
      name: 'A',
      admin: true,
      role: 'admin',
      apps: [],
      tokenVersion: 4,
    })
  })
})
