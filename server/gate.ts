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

/** Static / Vite internals: no user data. HTML, `/`, and `/api/*` stay gated. */
export function isUngatedPath(pathname: string): boolean {
  const path = pathname.split('?')[0] || '/'
  if (path === '/api' || path.startsWith('/api/')) return false
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

const OUTAGE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="5"><title>Hunt4Food</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#FBF3EC;color:#0B3D26;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center;padding:24px"><div><p style="font-size:20px;font-weight:700;margin:0 0 6px">Base Camp is catching its breath</p><p style="margin:0;color:#6B6F63">We could not confirm your sign-in. Retrying in a few seconds…</p></div></body></html>`

export async function handleLodgeGate(
  request: Request,
  env: LodgeEnv = lodgeEnvFrom(runtimeEnv()),
  deps: AuthorizeDeps = {},
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname
  if (isUngatedPath(pathname)) return null
  const decision = await authorizeRequest(request.headers.get('cookie'), env.LODGE_ORIGIN, deps)
  if (decision.type === 'allow') return null
  if (decision.type === 'unavailable') {
    // Pages get a small page that retries itself (a phone shows raw JSON otherwise); APIs get JSON.
    const json = requestWantsJson(request)
    return new Response(json ? JSON.stringify({ error: 'authentication_service_unavailable' }) : OUTAGE_PAGE, {
      status: 503,
      headers: {
        'content-type': json ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8',
        'cache-control': 'private, no-store',
        'retry-after': '5',
      },
    })
  }
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
