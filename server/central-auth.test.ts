import { describe, expect, it } from 'vitest'
import { lodgeEnvFrom } from './env.js'
import { handleLodgeGate } from './gate.js'
import { authorizeRequest } from './session.js'
import { SESSION_COOKIE, type SessionPayload } from './token.js'

const session: SessionPayload = {
  id: 'member-1',
  email: 'member@example.com',
  name: 'Member',
  admin: false,
  role: 'member',
  apps: [],
  tokenVersion: 1,
}

describe('central Base Camp auth without a project secret', () => {
  it('allows a valid live lodge session when AUTH_SECRET is absent', async () => {
    const decision = await authorizeRequest(
      `${SESSION_COOKIE}=opaque-session-token`,
      'https://andrewcamero.com',
      { fetchLodge: async () => session },
    )
    expect(decision).toEqual({ type: 'allow', session })
  })

  it('returns a retryable 503 on lodge outage instead of requiring AUTH_SECRET', async () => {
    const env = lodgeEnvFrom({
      LODGE_ORIGIN: 'https://andrewcamero.com',
      APP_SLUG: 'Hunt4Food',
    })
    const request = new Request('https://hunt4food.andrewcamero.com/', {
      headers: { cookie: `${SESSION_COOKIE}=opaque-session-token`, accept: 'text/html' },
    })
    const response = await handleLodgeGate(request, env, {
      fetchLodge: async () => 'unavailable',
    })
    expect(response?.status).toBe(503)
    expect(response?.headers.get('retry-after')).toBe('5')
  })
})
