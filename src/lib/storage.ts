const PREFIX = 'openplate:'

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Quota or private mode — ignore
  }
}

type CacheEntry<T> = {
  savedAt: number
  ttlMs: number
  value: T
}

export function readCache<T>(key: string): T | null {
  const entry = readJson<CacheEntry<T> | null>(`cache:${key}`, null)
  if (!entry) return null
  if (Date.now() - entry.savedAt > entry.ttlMs) return null
  return entry.value
}

export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  writeJson(`cache:${key}`, {
    savedAt: Date.now(),
    ttlMs,
    value,
  } satisfies CacheEntry<T>)
}

/** UTC calendar date YYYY-MM-DD — used to bucket daily caches. */
export function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Milliseconds until end of current UTC day (minimum 1 minute). */
export function cacheTtlUntilEndOfUtcDay(): number {
  const now = new Date()
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return Math.max(60_000, end - now.getTime())
}

/** Drop expired cache keys to keep localStorage lean. */
export function pruneExpiredCache(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const full = localStorage.key(i)
      if (!full?.startsWith(PREFIX + 'cache:')) continue
      const raw = localStorage.getItem(full)
      if (!raw) continue
      try {
        const entry = JSON.parse(raw) as CacheEntry<unknown>
        if (Date.now() - entry.savedAt > entry.ttlMs) toRemove.push(full)
      } catch {
        toRemove.push(full)
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}
