import { next } from '@vercel/functions'
import { handleLodgeGate } from './server/gate.js'

export const config = {
  runtime: 'nodejs',
  // Only immutable production assets bypass auth. Source/dev paths stay gated.
  matcher: ['/((?!assets/|favicon\\.svg|hunt4food-logo\\.svg).*)'],
}

export default async function middleware(request: Request) {
  const blocked = await handleLodgeGate(request)
  if (blocked) return blocked
  return next()
}
