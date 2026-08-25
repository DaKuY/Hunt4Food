import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Connect, type Plugin, type ViteDevServer } from 'vite'
import { handleLodgeGate, lodgeEnvFrom, type LodgeEnv } from './gate'

export function lodgeAuthPlugin(): Plugin {
  return {
    name: 'lodge-auth-gate',
    configureServer(server) {
      installGate(server)
    },
    configurePreviewServer(server) {
      installGate(server)
    },
  }
}

function installGate(server: ViteDevServer | { config: ViteDevServer['config']; middlewares: ViteDevServer['middlewares'] }) {
  const env = lodgeEnvFrom({
    ...loadEnv(server.config.mode, server.config.root, ''),
    ...process.env,
  })
  server.middlewares.use(createLodgeConnectMiddleware(env))
}

export function createLodgeConnectMiddleware(env: LodgeEnv): Connect.NextHandleFunction {
  return (req, res, next) => {
    void applyGate(req, res, next, env)
  }
}

async function applyGate(
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
  env: LodgeEnv,
): Promise<void> {
  try {
    const request = incomingToRequest(req)
    const blocked = await handleLodgeGate(request, env)
    if (!blocked) {
      next()
      return
    }
    await writeWebResponse(res, blocked)
  } catch (err) {
    next(err)
  }
}

function incomingToRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? 'localhost'
  const forwarded = headerValue(req.headers['x-forwarded-proto'])
  const proto = forwarded ?? 'http'
  const url = `${proto}://${host}${req.url ?? '/'}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  return new Request(url, { method: req.method ?? 'GET', headers })
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  const body = Buffer.from(await response.arrayBuffer())
  res.end(body)
}
