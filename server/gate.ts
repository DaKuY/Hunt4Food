import { lodgeEnvFrom, loginUrl, needUrl, type LodgeEnv } from './env'
import {
  authorizeRequest,
  publicOriginFrom,
  requestWantsJson,
  type AuthorizeDeps,
  type GateDecision,
} from './session'

export type { LodgeEnv }
export { lodgeEnvFrom }

const PUBLIC_FILES = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/hunt4food-logo.svg',
  '/robots.txt',
])

/** Static / Vite internals: no user data. HTML, `/`, and `/api/*` stay gated. */
export function isUngatedPath(pathname: string): boolean {
  const path = pathname.split('?')[0] || '/'
  if (PUBLIC_FILES.has(path)) return true
  if (
    path.startsWith('/assets/') ||
    path.startsWith('/.well-known/') ||
    path.startsWith('/.vite/') ||
    path.startsWith('/@') ||
    path.startsWith('/node_modules/') ||
    path.startsWith('/src/')
  ) {
    return true
  }
  return /\.(?:css|js|mjs|cjs|map|woff2?|ttf|eot|png|jpe?g|gif|svg|ico|webp)$/i.test(path)
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
    env.AUTH_SECRET,
    env.LODGE_ORIGIN,
    env.APP_SLUG,
    deps,
  )
  if (decision.type === 'allow') return null
  return responseForDecision(decision, request, env)
}

export function responseForDecision(
  decision: Exclude<GateDecision, { type: 'allow' }>,
  request: Request,
  env: LodgeEnv,
): Response {
  const json = requestWantsJson(request)
  if (decision.type === 'login') {
    if (json) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }
    const next = publicOriginFrom(request)
    return Response.redirect(loginUrl(env.LODGE_ORIGIN, next), 302)
  }
  if (json) {
    return jsonResponse({ error: 'forbidden', need: env.APP_SLUG }, 403)
  }
  return Response.redirect(needUrl(env.LODGE_ORIGIN, env.APP_SLUG), 302)
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
