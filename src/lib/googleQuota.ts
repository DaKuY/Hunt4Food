import { readJson, writeJson } from './storage'

/**
 * Google Places Text Search (New) ≈ $32 / 1,000 requests after the $200/mo Maps credit.
 * Cap well below that so personal use never bills:
 * - 40 calls/day ≈ 4 full result pages (10 places each)
 * - 400 calls/month hard stop
 */
export const GOOGLE_DAILY_LIMIT = 40
export const GOOGLE_MONTHLY_LIMIT = 400

type QuotaSnapshot = {
  dailyUsed: number
  monthlyUsed: number
  dailyRemaining: number
  monthlyRemaining: number
  canRequest: boolean
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

function readDaily(): number {
  return readJson<number>(`googleQuota:daily:${todayKey()}`, 0)
}

function readMonthly(): number {
  return readJson<number>(`googleQuota:monthly:${monthKey()}`, 0)
}

export function getGoogleQuota(): QuotaSnapshot {
  const dailyUsed = readDaily()
  const monthlyUsed = readMonthly()
  const dailyRemaining = Math.max(0, GOOGLE_DAILY_LIMIT - dailyUsed)
  const monthlyRemaining = Math.max(0, GOOGLE_MONTHLY_LIMIT - monthlyUsed)
  return {
    dailyUsed,
    monthlyUsed,
    dailyRemaining,
    monthlyRemaining,
    canRequest: dailyRemaining > 0 && monthlyRemaining > 0,
  }
}

/** Reserve one Google Places call. Returns false when daily/monthly cap is reached. */
export function consumeGoogleQuota(): boolean {
  const q = getGoogleQuota()
  if (!q.canRequest) return false
  writeJson(`googleQuota:daily:${todayKey()}`, q.dailyUsed + 1)
  writeJson(`googleQuota:monthly:${monthKey()}`, q.monthlyUsed + 1)
  return true
}

export function googleQuotaMessage(): string {
  const q = getGoogleQuota()
  if (q.canRequest) {
    return `${q.dailyRemaining} Google rating lookups left today (${q.monthlyRemaining} this month).`
  }
  if (q.dailyRemaining <= 0) {
    return `Daily Google limit reached (${GOOGLE_DAILY_LIMIT}/day). Cached ratings still show. Resets at midnight UTC.`
  }
  return `Monthly Google limit reached (${GOOGLE_MONTHLY_LIMIT}/month). Cached ratings still show.`
}
