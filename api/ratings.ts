const ALLOWED_SOURCES = new Set(['google', 'yelp', 'tripadvisor', 'healthyDiscover', 'healthyReviews'])

const buckets = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60_000
const REQUESTS_PER_MINUTE = 60

function clientIp(req: any): string {
  const raw = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || 'unknown'
  return String(raw).split(',')[0].trim()
}

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const existing = buckets.get(ip)
  if (!existing || now >= existing.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (existing.count >= REQUESTS_PER_MINUTE) return true
  existing.count += 1
  return false
}

function one(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return String(value ?? '')
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  if (rateLimited(clientIp(req))) {
    res.setHeader('Retry-After', '60')
    res.status(429).json({ error: 'rate_limited' })
    return
  }

  const upstream = process.env.RATINGS_UPSTREAM_URL?.trim()
  const secret = process.env.RATINGS_PROXY_SECRET?.trim()
  if (!upstream || !secret) {
    res.status(503).json({ error: 'ratings_proxy_not_configured' })
    return
  }

  const source = one(req.query?.source)
  if (!ALLOWED_SOURCES.has(source)) {
    res.status(400).json({ error: 'invalid_source' })
    return
  }

  const out = new URL(upstream)
  const allowed = ['source', 'name', 'city', 'lat', 'lon', 'radius', 'ids', 'names', 'dishes']
  for (const key of allowed) {
    const value = one(req.query?.[key]).slice(0, key === 'ids' || key === 'names' ? 2000 : 300)
    if (value) out.searchParams.set(key, value)
  }
  out.searchParams.set('proxySecret', secret)

  try {
    const upstreamResponse = await fetch(out, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: { accept: 'application/json' },
    })
    if (!upstreamResponse.ok) {
      res.status(502).json({ error: 'ratings_upstream_failed' })
      return
    }
    const data = await upstreamResponse.json()
    res.status(200).json(data)
  } catch {
    res.status(502).json({ error: 'ratings_upstream_unavailable' })
  }
}
