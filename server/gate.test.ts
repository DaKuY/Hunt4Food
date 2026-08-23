import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { lodgeEnvFrom, loginUrl, needUrl } from './env.ts'
import { handleLodgeGate } from './gate.ts'
import { authorizeRequest, hasAppGrant, type LodgeLookup } from './session.ts'
import { SESSION_COOKIE, type SessionPayload } from './token.ts'

const SECRET = 'test-auth-secret-that-is-long-enough'
const SLUG = 'Hunt4Food'
const LODGE = 'https://andrewcamero.com'
const ORIGIN = 'https://Hunt4Food.andrewcamero.com'
const ORIGIN_CANONICAL = new URL(ORIGIN).origin

const env = lodgeEnvFrom({
  AUTH_SECRET: SECRET,
  COOKIE_DOMAIN: '.andrewcamero.com',
  LODGE_ORIGIN: LODGE,
  APP_SLUG: SLUG,
})

function claims(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    id: 'user-1',
    email: 'member@example.com',
    name: 'Member',
    role: 'member',
    apps: [],
    tokenVersion: 1,
    ...overrides,
  }
}

async function sign(payload: SessionPayload, secret = SECRET): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode(secret))
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

  it('allows an admin without a grant row', async () => {
    const session = claims({
      id: 'admin-1',
      email: 'drewe927@gmail.com',
      name: 'Andrew Camero',
      role: 'admin',
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

  it('rejects a cookie signed with the wrong secret', async () => {
    const token = await sign(claims({ apps: [SLUG] }), 'some-other-secret')
    const decision = await authorizeRequest(cookieHeader(token), SECRET, LODGE, SLUG, {
      fetchLodge: async () => 'unavailable',
    })
    expect(decision.type).toBe('login')
  })
})
