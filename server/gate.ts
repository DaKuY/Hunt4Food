import { lodgeEnvFrom, loginUrl, needUrl, type LodgeEnv } from './env.ts'
import {
  authorizeRequest,
  publicOriginFrom,
  requestWantsJson,
  type AuthorizeDeps,
  type GateDecision,
} from './session.ts'

export type { LodgeEnv }
export { lodgeEnvFrom }

export async function handleLodgeGate(
  request: Request,
  env: LodgeEnv = lodgeEnvFrom(process.env),
  deps: AuthorizeDeps = {},
): Promise<Response | null> {
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
