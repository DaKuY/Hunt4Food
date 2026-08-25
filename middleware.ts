import { next } from '@vercel/functions'
import { handleLodgeGate } from './server/gate'

export const config = {
  runtime: 'nodejs',
  // Hashed static assets have no user data. Gate HTML + APIs in handleLodgeGate.
  matcher: ['/((?!assets/|src/|node_modules/|\\.well-known/|@|favicon\\.svg|hunt4food-logo\\.svg).*)'],
}

export default async function middleware(request: Request) {
  const blocked = await handleLodgeGate(request)
  if (blocked) return blocked
  return next()
}
