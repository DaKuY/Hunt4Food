import type { PlaceRatings } from '../lib/ratings'
import { safeExternalUrl } from '../lib/links'
import { formatRating } from '../lib/ratings'

type Props = {
  ratings: PlaceRatings | null
  loading?: boolean
}

const FALLBACK_URLS = {
  google: 'https://www.google.com/maps',
  yelp: 'https://www.yelp.com',
  tripadvisor: 'https://www.tripadvisor.com',
} as const

const LABELS = {
  google: 'Google',
  yelp: 'Yelp',
  tripadvisor: 'TripAdvisor',
} as const

export function RatingsRow({ ratings, loading }: Props) {
  if (loading && !ratings) {
    return <p className="ratings-row muted">Loading ratings…</p>
  }
  if (!ratings) return null

  return (
    <div className="ratings-row">
      {(['google', 'yelp', 'tripadvisor'] as const).map((key) => {
        const r = ratings[key]
        return (
          <a
            key={key}
            className={`rating-pill${r.rating == null ? ' rating-pill--empty' : ''}`}
            href={safeExternalUrl(r.url, FALLBACK_URLS[key])}
            target="_blank"
            rel="noreferrer"
            title={r.error ?? (r.rating != null ? `Open ${LABELS[key]}` : `Open ${LABELS[key]} (rating unavailable)`)}
          >
            <span className="rating-source">{LABELS[key]}</span>
            <span className="rating-value">
              {r.rating != null
                ? formatRating(r)
                : r.error?.includes('proxy') || r.error?.includes('blocked')
                  ? 'Fix proxy'
                  : r.error?.includes('limit')
                    ? 'Limit'
                    : '—'}
            </span>
          </a>
        )
      })}
    </div>
  )
}
