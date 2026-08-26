export type LodgeEnv = {
  AUTH_SECRET: string
  COOKIE_DOMAIN: string
  LODGE_ORIGIN: string
  APP_SLUG: string
}

const DEFAULT_LODGE_ORIGIN = 'https://andrewcamero.com'
const DEFAULT_APP_SLUG = 'Hunt4Food'

export function lodgeEnvFrom(source: Record<string, string | undefined>): LodgeEnv {
  return {
    // Retained for deployment compatibility only; product auth no longer verifies JWTs locally.
    AUTH_SECRET: source.AUTH_SECRET?.trim() ?? '',
    COOKIE_DOMAIN: source.COOKIE_DOMAIN?.trim() ?? '',
    LODGE_ORIGIN: stripTrailingSlash(source.LODGE_ORIGIN?.trim() || DEFAULT_LODGE_ORIGIN),
    APP_SLUG: source.APP_SLUG?.trim() || DEFAULT_APP_SLUG,
  }
}

export function loginUrl(lodgeOrigin: string, nextUrl: string): string {
  return `${lodgeOrigin}/login?next=${encodeURIComponent(nextUrl)}`
}

export function needUrl(lodgeOrigin: string, slug: string): string {
  return `${lodgeOrigin}/?need=${encodeURIComponent(slug)}`
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}
