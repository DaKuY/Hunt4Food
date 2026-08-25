import { next } from '@vercel/functions'
import { handleLodgeGate, lodgeEnvFrom } from './server/gate.ts'

export const config = {
  runtime: 'nodejs',
  // Hashed static assets have no user data. Gate HTML + APIs in handleLodgeGate.
  matcher: ['/((?!assets/|src/|node_modules/|\\.well-known/|@|favicon\\.svg|hunt4food-logo\\.svg).*)'],
}

export default async function middleware(request: Request) {
  const env = lodgeEnvFrom(process.env)
  const blocked = await handleLodgeGate(request, env)
  if (blocked) return blocked
  return next()
}
