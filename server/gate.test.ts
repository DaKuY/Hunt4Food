import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { lodgeEnvFrom, loginUrl, needUrl } from './env'
import { handleLodgeGate, isUngatedPath } from './gate'
import {
  authorizeRequest,
  fetchLodgeSession,
  hasAppGrant,
  sessionFromUnknown,
  type LodgeLookup,
} from './session'
import { parseSessionPayload, SESSION_COOKIE, type SessionPayload } from './token'

const SECRET = 'test-auth-secret-that-is-long-enough'
const SLUG = 'Hunt4Food'
const LODGE = 'https://andrewcamero.com'
const ORIGIN = 'https://hunt4food.andrewcamero.com'
const ORIGIN_CANONICAL = new URL(ORIGIN).origin

const env = lodgeEnvFrom({
  AUTH_SECRET: SECRET,
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

async function sign(payload: SessionPayload, secret = SECRET): Promise<string> {
  return new SignJWT({
    sub: payload.id,
    id: payload.id,
    email: payload.email,
    name: payload.name,
    admin: payload.admin,
    role: payload.role,
    apps: payload.apps,
    tv: payload.tokenVersion,
    tokenVersion: payload.tokenVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.id)
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode(secret))
}

async function signCanonical(input: {
  sub: string
  email: string
  name: string
  admin: boolean
  apps: string[]
  tv: number
}): Promise<string> {
  return new SignJWT({
    email: input.email,
    name: input.name,
    admin: input.admin,
    apps: input.apps,
    tv: input.tv,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.sub)
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode(SECRET))
}

function cookieHeader(token: string): string {
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

  it('denies a member without Hunt4Food', async () => {
    const token = await sign(claims({ apps: ['hunt'] }))
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => 'unavailable',
    })
    expect(decision.type).toBe('need')

    const html = await handleLodgeGate(htmlRequest(cookieHeader(token)), env, {
      fetchLodge: async () => 'unavailable',
    })
    expect(html!.status).toBe(302)
    expect(html!.headers.get('location')).toBe(needUrl(LODGE, SLUG))
    expect(html!.headers.get('location')).toBe('https://andrewcamero.com/?need=Hunt4Food')

    const api = await handleLodgeGate(apiRequest(cookieHeader(token)), env, {
      fetchLodge: async () => 'unavailable',
    })
    expect(api!.status).toBe(403)
  })

  it('allows a member with Hunt4Food', async () => {
    const session = claims({ apps: [SLUG] })
    const token = await sign(session)
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => 'unavailable',
    })
    expect(decision).toEqual({ type: 'allow', session })

    const html = await handleLodgeGate(htmlRequest(cookieHeader(token)), env, {
      fetchLodge: async () => 'unavailable',
    })
    expect(html).toBeNull()
  })

  it('allows a member whose grant is hunt4food (case-insensitive)', async () => {
    const token = await sign(claims({ apps: ['hunt4food'] }))
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => 'unavailable',
    })
    expect(decision.type).toBe('allow')
    expect(hasAppGrant({ admin: false, role: 'member', apps: ['hunt4food'] }, SLUG)).toBe(true)
  })

  it('allows an admin without a grant row', async () => {
    const session = claims({
      id: 'admin-1',
      email: 'drewe927@gmail.com',
      name: 'Andrew Camero',
      role: 'admin',
      admin: true,
      apps: [],
    })
    const token = await sign(session)
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => 'unavailable',
    })
    expect(decision.type).toBe('allow')
    expect(hasAppGrant(session, SLUG)).toBe(true)

    const html = await handleLodgeGate(htmlRequest(cookieHeader(token)), env, {
      fetchLodge: async () => 'unavailable',
    })
    expect(html).toBeNull()
  })

  it('allows admin:true even when apps[] is empty and role is omitted on the lodge user', async () => {
    const token = await sign(claims({ apps: [] }))
    const live: LodgeLookup = {
      id: 'admin-1',
      email: 'drewe927@gmail.com',
      name: 'Andrew Camero',
      admin: true,
      role: 'admin',
      apps: [],
      tokenVersion: 3,
    }
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => live,
    })
    expect(decision.type).toBe('allow')
  })

  it('verifies canonical JWT claims (sub, admin, apps, tv)', async () => {
    const token = await signCanonical({
      sub: 'user-1',
      email: 'member@example.com',
      name: 'Member',
      admin: false,
      apps: [SLUG],
      tv: 1,
    })
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => 'unavailable',
    })
    expect(decision.type).toBe('allow')
    if (decision.type === 'allow') {
      expect(decision.session.id).toBe('user-1')
      expect(decision.session.tokenVersion).toBe(1)
      expect(decision.session.admin).toBe(false)
    }
  })

  it('prefers live lodge grants over a stale JWT apps list', async () => {
    const stale = claims({ apps: [SLUG] })
    const token = await sign(stale)
    const live: LodgeLookup = claims({ apps: [] })
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => live,
    })
    expect(decision.type).toBe('need')
  })

  it('uses a lodge grant refresh when the JWT apps list is empty', async () => {
    const token = await sign(claims({ apps: [] }))
    const live = claims({ apps: [SLUG] })
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => live,
    })
    expect(decision.type).toBe('allow')
  })

  it('treats a lodge 401 as logged out even if the JWT still verifies', async () => {
    const token = await sign(claims({ apps: [SLUG], role: 'admin' }))
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => 'unauthorized',
    })
    expect(decision.type).toBe('login')
  })

  it('treats lodge { user: null } as logged out rather than falling back to JWT', async () => {
    expect(sessionFromUnknown({ user: null })).toBeNull()
    const token = await sign(claims({ apps: [SLUG] }))
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => 'unauthorized',
    })
    expect(decision.type).toBe('login')
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

  it('rejects a cookie signed with the wrong secret', async () => {
    const token = await sign(claims({ apps: [SLUG] }), 'some-other-secret')
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => 'unavailable',
    })
    expect(decision.type).toBe('login')
  })
})

describe('isUngatedPath', () => {
  it('keeps HTML and APIs gated', () => {
    expect(isUngatedPath('/')).toBe(false)
    expect(isUngatedPath('/index.html')).toBe(false)
    expect(isUngatedPath('/api/session')).toBe(false)
  })

  it('skips hashed assets, favicons, and Vite internals', () => {
    expect(isUngatedPath('/assets/index-abc123.js')).toBe(true)
    expect(isUngatedPath('/favicon.svg')).toBe(true)
    expect(isUngatedPath('/hunt4food-logo.svg')).toBe(true)
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
  it('does not treat hiding a catalog card as access — empty apps denies members', () => {
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
