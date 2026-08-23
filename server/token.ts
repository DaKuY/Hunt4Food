/**
 * Lodge session token helper (same contract as the lodge `web/src/lib/token.ts`).
 * Cookie name, HS256, and claim shape must stay aligned with andrewcamero.com.
 */
import { jwtVerify, type JWTPayload } from 'jose'

export const SESSION_COOKIE = 'ac_session'

export type Role = 'admin' | 'member'

export type SessionPayload = {
  id: string
  email: string
  name: string
  role: Role
  apps: string[]
  tokenVersion: number
}

function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'member'
}

export function parseSessionPayload(payload: JWTPayload | Record<string, unknown>): SessionPayload | null {
  const id = payload.id
  const email = payload.email
  const name = payload.name
  const role = payload.role
  const apps = payload.apps
  const tokenVersion = payload.tokenVersion

  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof email !== 'string' || email.length === 0) return null
  if (typeof name !== 'string') return null
  if (!isRole(role)) return null
  if (!Array.isArray(apps) || !apps.every((app) => typeof app === 'string')) return null
  if (typeof tokenVersion !== 'number' || !Number.isFinite(tokenVersion)) return null

  return { id, email, name, role, apps, tokenVersion }
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token || !secret) return null
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    })
    return parseSessionPayload(payload)
  } catch {
    return null
  }
}

export function readCookie(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    if (key === name) return trimmed.slice(eq + 1)
  }
  return undefined
}
