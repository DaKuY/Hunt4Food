/**
 * Lodge session token helper — same contract as
 * DaKuY/andrewcamero.com-orchestrator `src/lib/token.ts`.
 * Cookie name, HS256, and claim shape must stay aligned with andrewcamero.com.
 */
import { jwtVerify, type JWTPayload } from 'jose'

export const SESSION_COOKIE = 'ac_session'

export type Role = 'admin' | 'member'

export type SessionPayload = {
  id: string
  email: string
  name: string
  admin: boolean
  role: Role
  apps: string[]
  tokenVersion: number
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'member'
}

/** Lodge catalog grant helper. Hunt4Food access is login-only; grants are not required. */
export function hasAppGrant(
  session: { admin?: boolean; role?: string; apps?: unknown } | null | undefined,
  slug: string,
): boolean {
  if (!session || !slug) return false
  if (session.admin === true || session.role === 'admin') return true
  const apps = session.apps
  if (!Array.isArray(apps)) return false
  const want = slug.toLowerCase()
  return apps.some((app) => typeof app === 'string' && app.toLowerCase() === want)
}

export function parseSessionPayload(payload: JWTPayload | Record<string, unknown>): SessionPayload | null {
  const id = asNonEmptyString(payload.id) ?? asNonEmptyString(payload.sub)
  const email = asNonEmptyString(payload.email)
  const name = typeof payload.name === 'string' ? payload.name : undefined
  const apps = payload.apps
  const tokenVersion = asFiniteNumber(payload.tokenVersion) ?? asFiniteNumber(payload.tv)

  if (!id || !email || name === undefined || tokenVersion === undefined) return null
  if (!Array.isArray(apps) || !apps.every((app) => typeof app === 'string')) return null

  const admin = payload.admin === true || payload.role === 'admin'
  const role: Role = admin ? 'admin' : isRole(payload.role) ? payload.role : 'member'

  return { id, email, name, admin, role, apps, tokenVersion }
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
