import type { PlaceRatings } from '../lib/ratings'
import { formatRating } from '../lib/ratings'

type Props = {
  ratings: PlaceRatings | null
  loading?: boolean
}

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
            className="rating-pill"
            href={r.url}
            target="_blank"
            rel="noreferrer"
            title={r.error ?? `Open ${LABELS[key]}`}
          >
            <span className="rating-source">{LABELS[key]}</span>
            <span className="rating-value">{formatRating(r)}</span>
          </a>
        )
      })}
    </div>
  )
}
