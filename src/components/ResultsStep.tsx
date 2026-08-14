import {
  cityCuisineFallbackLinks,
  googleMapsUrl,
  menuOrWebsiteUrl,
  tripadvisorUrl,
  yelpUrl,
} from '../lib/links'
import { isProbablyOpenNow } from '../lib/rank'
import type { RankedRestaurant } from '../lib/types'
import { ResultsMap } from './ResultsMap'

type Props = {
  places: RankedRestaurant[]
  cityLabel: string
  cityCenter: { lat: number; lon: number }
  cuisineLabels: string[]
  loading: boolean
  error: string | null
  openNowOnly: boolean
  hasWebsiteOnly: boolean
  onToggleOpenNow: () => void
  onToggleWebsite: () => void
  onLove: (place: RankedRestaurant) => void
  onSkip: (place: RankedRestaurant) => void
  onShortlist: (place: RankedRestaurant) => void
  shortlistedIds: Set<string>
  lovedIds: Set<string>
  onBack: () => void
  onNewSearch: () => void
}

export function ResultsStep({
  places,
  cityLabel,
  cityCenter,
  cuisineLabels,
  loading,
  error,
  openNowOnly,
  hasWebsiteOnly,
  onToggleOpenNow,
  onToggleWebsite,
  onLove,
  onSkip,
  onShortlist,
  shortlistedIds,
  lovedIds,
  onBack,
  onNewSearch,
}: Props) {
  const filtered = places.filter((p) => {
    if (hasWebsiteOnly && !p.website) return false
    if (openNowOnly) {
      const open = isProbablyOpenNow(p.openingHours)
      if (open === false) return false
      // null (unknown) still shown when filter on — only hide known-closed
    }
    return true
  })

  const fallback = cityCuisineFallbackLinks(cityLabel, cuisineLabels)

  return (
    <section className="step results-step">
      <header className="step-header">
        <p className="eyebrow">Your top picks · {cityLabel}</p>
        <h2>Ten places worth checking</h2>
        <p className="lede">
          Ranked from OpenStreetMap for your area and taste. Open Google, Yelp, or TripAdvisor for live
          reviews.
        </p>
      </header>

      <div className="filters chip-row wrap">
        <button type="button" className={`chip ghost ${openNowOnly ? 'on' : ''}`} onClick={onToggleOpenNow}>
          Prefer open now
        </button>
        <button
          type="button"
          className={`chip ghost ${hasWebsiteOnly ? 'on' : ''}`}
          onClick={onToggleWebsite}
        >
          Has website
        </button>
      </div>

      {loading && (
        <div className="skeleton-stack" aria-live="polite">
          <p className="muted">Searching this neighborhood on OpenStreetMap…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="empty-state">
          <p>{error}</p>
          <div className="chip-row">
            <a className="btn primary" href={fallback.google} target="_blank" rel="noreferrer">
              Search Google Maps
            </a>
            <a className="btn ghost" href={fallback.yelp} target="_blank" rel="noreferrer">
              Search Yelp
            </a>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <p>
            Map data looks thin here for those cuisines. Zoom to a denser neighborhood, try different
            food types, or jump to Google / Yelp for this city.
          </p>
          <div className="chip-row">
            <a className="btn primary" href={fallback.google} target="_blank" rel="noreferrer">
              Google: {cuisineLabels.join(', ')} in {cityLabel}
            </a>
            <a className="btn ghost" href={fallback.yelp} target="_blank" rel="noreferrer">
              Yelp search
            </a>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <ResultsMap places={filtered} center={cityCenter} />
      )}

      <ol className="result-list">
        {filtered.map((place, index) => {
          const menu = menuOrWebsiteUrl(place, cityLabel)
          return (
            <li key={place.id} className="result-card">
              <div className="result-rank">{index + 1}</div>
              <div className="result-body">
                <h3>{place.name}</h3>
                <p className="meta">
                  {place.cuisines.slice(0, 3).join(' · ') || place.amenity || 'Restaurant'}
                  {place.distanceKm < 50 ? ` · ${place.distanceKm.toFixed(1)} km` : ''}
                  {place.address ? ` · ${place.address}` : ''}
                </p>
                <ul className="reasons">
                  {place.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <div className="link-row">
                  <a href={googleMapsUrl(place, cityLabel)} target="_blank" rel="noreferrer">
                    Google reviews
                  </a>
                  <a href={yelpUrl(place, cityLabel)} target="_blank" rel="noreferrer">
                    Yelp
                  </a>
                  <a href={tripadvisorUrl(place, cityLabel)} target="_blank" rel="noreferrer">
                    TripAdvisor
                  </a>
                  <a href={menu.href} target="_blank" rel="noreferrer">
                    {menu.label}
                  </a>
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className={`btn tiny ${lovedIds.has(place.id) ? 'primary' : 'ghost'}`}
                    onClick={() => onLove(place)}
                  >
                    Loved it
                  </button>
                  <button type="button" className="btn tiny ghost" onClick={() => onSkip(place)}>
                    Not for me
                  </button>
                  <button
                    type="button"
                    className={`btn tiny ${shortlistedIds.has(place.id) ? 'primary' : 'ghost'}`}
                    onClick={() => onShortlist(place)}
                  >
                    {shortlistedIds.has(place.id) ? 'Shortlisted' : 'Shortlist'}
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="step-actions row">
        <button type="button" className="btn ghost" onClick={onBack}>
          Change food
        </button>
        <button type="button" className="btn ghost" onClick={onNewSearch}>
          New city
        </button>
      </div>
    </section>
  )
}
