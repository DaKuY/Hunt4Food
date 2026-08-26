import { lodgeEnvFrom, loginUrl, type LodgeEnv } from './env.js'
import {
  authorizeRequest,
  publicOriginFrom,
  requestWantsJson,
  type AuthorizeDeps,
} from './session.js'

export type { LodgeEnv }
export { lodgeEnvFrom }

const PUBLIC_FILES = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/hunt4food-logo.svg',
  '/robots.txt',
])

/** Only immutable production assets and explicitly public files bypass auth. */
export function isUngatedPath(pathname: string): boolean {
  const path = pathname.split('?')[0] || '/'
  if (PUBLIC_FILES.has(path)) return true
  if (path.startsWith('/assets/')) return true
  return /\.(?:css|js|mjs|woff2?|ttf|eot|png|jpe?g|gif|svg|ico|webp)$/i.test(path) && path.startsWith('/assets/')
}

export async function handleLodgeGate(
  request: Request,
  env: LodgeEnv = lodgeEnvFrom(runtimeEnv()),
  deps: AuthorizeDeps = {},
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname
  if (isUngatedPath(pathname)) return null
  const decision = await authorizeRequest(
    request.headers.get('cookie'),
    env.LODGE_ORIGIN,
    deps,
  )
  if (decision.type === 'allow') return null
  return loginResponse(request, env)
}

function loginResponse(request: Request, env: LodgeEnv): Response {
  if (requestWantsJson(request)) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }
  const next = publicOriginFrom(request)
  return Response.redirect(loginUrl(env.LODGE_ORIGIN, next), 302)
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  })
}

function runtimeEnv(): Record<string, string | undefined> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env ?? {}
}
