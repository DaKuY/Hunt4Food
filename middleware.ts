import { next } from '@vercel/functions'
import { handleLodgeGate, lodgeEnvFrom } from './server/gate.ts'

export const config = {
  runtime: 'nodejs' as const,
}

export default async function middleware(request: Request) {
  const env = lodgeEnvFrom(process.env)
  const blocked = await handleLodgeGate(request, env)
  if (blocked) return blocked
  return next()
}
