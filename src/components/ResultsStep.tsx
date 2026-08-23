import { lazy, Suspense, useEffect, useState } from 'react'
import {
  cityCuisineFallbackLinks,
  googleMapsUrl,
  menuOrWebsiteUrl,
  openTableUrl,
  tripadvisorUrl,
  yelpUrl,
} from '../lib/links'
import { HEALTHY_LANE_LABELS, signalSourceLabel } from '../lib/healthySignals'
import { FIRST_RESULT_ID, scrollToFirstResult } from '../lib/scroll'
import type { PlaceRatings } from '../lib/ratings'
import { isFastFood, isProbablyOpenNow } from '../lib/rank'
import type { SeedOilInfo } from '../lib/seedOil'
import type { HealthyLane, RankedRestaurant } from '../lib/types'
import { RatingsRow } from './RatingsRow'

const ResultsMap = lazy(() =>
  import('./ResultsMap').then((m) => ({ default: m.ResultsMap })),
)

type Props = {
  places: RankedRestaurant[]
  cityLabel: string
  cityCenter: { lat: number; lon: number }
  cuisineLabels: string[]
  keyword?: string
  loading: boolean
  error: string | null
  healthyMode?: boolean
  searchStatus?: string | null
  openNowOnly: boolean
  hasWebsiteOnly: boolean
  noFastFood: boolean
  ratingsMap: Record<string, PlaceRatings>
  ratingsLoading: boolean
  seedOilMap: Record<string, SeedOilInfo>
  seedOilLoading: boolean
  showSeedOil: boolean
  dishesMap: Record<string, string[]>
  dishesLoading: boolean
  favoriteIds: Set<string>
  onToggleFavorite: (place: RankedRestaurant) => void
  onSearchAgain: () => void
  onToggleOpenNow: () => void
  onToggleWebsite: () => void
  onToggleNoFastFood: () => void
  onLove: (place: RankedRestaurant) => void
  onSkip: (place: RankedRestaurant) => void
  onShortlist: (place: RankedRestaurant) => void
  onRetry: () => void
  onCopySearchLink: () => void
  shareMessage: string | null
  shortlistedIds: Set<string>
  lovedIds: Set<string>
  onBack: () => void
  onNewSearch: () => void
  scrollToResultsKey?: number
}

const LANE_ORDER: HealthyLane[] = ['clean_cooking', 'smoothie', 'protein']

export function ResultsStep({
  places,
  cityLabel,
  cityCenter,
  cuisineLabels,
  keyword,
  loading,
  error,
  healthyMode = false,
  searchStatus = null,
  openNowOnly,
  hasWebsiteOnly,
  noFastFood,
  ratingsMap,
  ratingsLoading,
  seedOilMap,
  seedOilLoading,
  showSeedOil,
  dishesMap,
  dishesLoading,
  favoriteIds,
  onToggleFavorite,
  onSearchAgain,
  onToggleOpenNow,
  onToggleWebsite,
  onToggleNoFastFood,
  onLove,
  onSkip,
  onShortlist,
  onRetry,
  onCopySearchLink,
  shareMessage,
  shortlistedIds,
  lovedIds,
  onBack,
  onNewSearch,
  scrollToResultsKey = 0,
}: Props) {
  const filtered = places.filter((p) => {
    if (noFastFood && isFastFood(p)) return false
    if (hasWebsiteOnly && !p.website) return false
    if (openNowOnly) {
      const open = isProbablyOpenNow(p.openingHours)
      if (open === false) return false
    }
    return true
  })

  const favoriteCount = places.filter((p) => favoriteIds.has(p.id)).length
  const fallback = cityCuisineFallbackLinks(cityLabel, cuisineLabels, keyword)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if ((loading && filtered.length === 0) || filtered.length === 0) {
      setMapReady(false)
      return
    }
    const id = window.setTimeout(() => setMapReady(true), 0)
    return () => window.clearTimeout(id)
  }, [loading, filtered.length])

  useEffect(() => {
    if (!scrollToResultsKey || loading || filtered.length === 0) return
    scrollToFirstResult()
  }, [scrollToResultsKey, loading, filtered.length])

  function renderCard(place: RankedRestaurant, rank: number) {
    const menu = menuOrWebsiteUrl(place, cityLabel)
    const ratings = ratingsMap[place.id] ?? null
    const seedOil = seedOilMap[place.id]
    const dishes = dishesMap[place.id]
    const isFavorite = favoriteIds.has(place.id)
    const signals = place.signals ?? []
    return (
      <li
        key={place.id}
        id={rank === 1 ? FIRST_RESULT_ID : undefined}
        className={`result-card${isFavorite ? ' result-card--favorite' : ''}`}
      >
        <div className="result-rank">{rank}</div>
        <div className="result-body">
          <h3>
            {place.name}
            {isFavorite && <span className="favorite-badge">Favorite</span>}
          </h3>
          <p className="meta">
            {place.cuisines.slice(0, 3).join(' · ') || place.amenity || 'Restaurant'}
            {ratings?.price.label ? (
              <>
                {' · '}
                <span className="price-range" title="Typical price range">
                  {ratings.price.label}
                </span>
              </>
            ) : ratingsLoading ? (
              <>
                {' '}
                · <span className="muted">price…</span>
              </>
            ) : null}
            {place.distanceKm < 50 ? ` · ${place.distanceKm.toFixed(1)} km` : ''}
            {place.address ? ` · ${place.address}` : ''}
            {place.phone ? (
              <>
                {' · '}
                <a href={`tel:${place.phone.replace(/\s/g, '')}`}>{place.phone}</a>
              </>
            ) : null}
          </p>
          <RatingsRow ratings={ratings} loading={ratingsLoading && !ratings} />
          {signals.length > 0 && (
            <div className="signal-row">
              {signals.map((sig) => (
                <span
                  key={`${place.id}-${sig.id}`}
                  className="signal-chip"
                  title={`${signalSourceLabel(sig.source)}${sig.quote ? ` — ${sig.quote}` : ''}`}
                >
                  {sig.label}
                </span>
              ))}
            </div>
          )}
          {place.evidenceQuote ? <p className="evidence-quote">{place.evidenceQuote}</p> : null}
          {seedOil?.grade ? (
            <p className="seed-oil-badge">
              <a href={seedOil.url} target="_blank" rel="noreferrer" title={seedOil.cookingOil ?? undefined}>
                Seed Oil Tracker: grade {seedOil.grade}
                {seedOil.risk ? ` · ${seedOil.risk}` : ''}
                {seedOil.chain ? ` · ${seedOil.chain}` : ''}
              </a>
            </p>
          ) : seedOilLoading && showSeedOil ? (
            <p className="seed-oil-badge muted">Checking seed-oil data…</p>
          ) : null}
          {dishes?.length ? (
            <p className="popular-dishes">
              <span className="popular-dishes-label">Popular dishes</span>
              {dishes.join(' · ')}
            </p>
          ) : dishesLoading ? (
            <p className="popular-dishes muted">Loading popular dishes…</p>
          ) : null}
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
            <a href={openTableUrl(place, cityLabel)} target="_blank" rel="noreferrer">
              OpenTable
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
              className={`btn tiny ${isFavorite ? 'primary' : 'ghost'}`}
              onClick={() => onToggleFavorite(place)}
            >
              {isFavorite ? '★ Favorited' : '☆ Favorite'}
            </button>
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
  }

  const laneGroups = healthyMode
    ? LANE_ORDER.map((lane) => ({
        lane,
        places: filtered.filter((p) => (p.lane ?? 'clean_cooking') === lane),
      })).filter((g) => g.places.length > 0)
    : []

  let rankCursor = 0

  return (
    <section className="step results-step">
      <header className="step-header">
        <p className="eyebrow">Hunt4Food · {cityLabel}</p>
        <h2>{healthyMode ? 'Healthy spots worth the hunt' : 'Ten places worth the hunt'}</h2>
        <p className="lede">
          {healthyMode ? (
            <>
              Live search for clean-cooking restaurants, smoothie shops, and healthy salmon or chicken
              {keyword ? (
                <>
                  {' '}
                  with a boost for <strong>{keyword}</strong>
                </>
              ) : null}
              . Mentions come from public reviews and listings, not a kitchen inspection.{' '}
            </>
          ) : keyword && cuisineLabels.length === 0 ? (
            <>
              Ranked for places matching <strong>{keyword}</strong> in your area.{' '}
            </>
          ) : (
            <>
              Ranked for your area and taste
              {keyword ? (
                <>
                  {' '}
                  with a boost for <strong>{keyword}</strong>
                </>
              ) : null}{' '}
              — good food you&apos;d actually want, not endless scrolling.{' '}
            </>
          )}
          Star <strong>Favorite</strong> places you want to keep, then <strong>Find more restaurants</strong> to
          swap out the rest for fresh options.
        </p>
      </header>

      {shareMessage && <p className="banner">{shareMessage}</p>}
      {healthyMode && searchStatus ? (
        <p className="healthy-status" aria-live="polite">
          {searchStatus}
        </p>
      ) : null}

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
        <button
          type="button"
          className={`chip ghost ${noFastFood ? 'on' : ''}`}
          onClick={onToggleNoFastFood}
        >
          No fast food
        </button>
        <button type="button" className="chip ghost" onClick={onCopySearchLink}>
          Copy search link
        </button>
        {!(loading && filtered.length === 0) && filtered.length > 0 && (
          <button type="button" className="chip primary" onClick={onSearchAgain}>
            Find more restaurants
            {favoriteCount > 0 ? ` (keep ${favoriteCount} favorite${favoriteCount === 1 ? '' : 's'})` : ''}
          </button>
        )}
      </div>

      {loading && filtered.length === 0 && (
        <div className="skeleton-stack" aria-live="polite">
          <p className="muted">
            {healthyMode
              ? 'Starting a healthy review search…'
              : 'Searching this neighborhood on OpenStreetMap…'}
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      )}

      {error && !loading && filtered.length === 0 && (
        <div className="empty-state">
          <p>{error}</p>
          <div className="chip-row wrap">
            <button type="button" className="btn primary" onClick={onRetry}>
              Try again
            </button>
            <a className="btn ghost" href={fallback.google} target="_blank" rel="noreferrer">
              Google Maps
            </a>
            <a className="btn ghost" href={fallback.yelp} target="_blank" rel="noreferrer">
              Yelp
            </a>
            <a className="btn ghost" href={fallback.tripadvisor} target="_blank" rel="noreferrer">
              TripAdvisor
            </a>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <p>
            {keyword && cuisineLabels.length === 0
              ? `No mapped places in this area mention “${keyword}”. Try a broader phrase, zoom to a denser neighborhood, or pick a food type.`
              : 'Map data looks thin here for those cuisines. Zoom to a denser neighborhood, try different food types, or jump to Google / Yelp / TripAdvisor for this city.'}
          </p>
          <div className="chip-row wrap">
            <a className="btn primary" href={fallback.google} target="_blank" rel="noreferrer">
              Google
            </a>
            <a className="btn ghost" href={fallback.yelp} target="_blank" rel="noreferrer">
              Yelp
            </a>
            <a className="btn ghost" href={fallback.tripadvisor} target="_blank" rel="noreferrer">
              TripAdvisor
            </a>
          </div>
        </div>
      )}

      {filtered.length > 0 && mapReady && (
        <Suspense fallback={null}>
          <ResultsMap places={filtered} center={cityCenter} />
        </Suspense>
      )}

      {healthyMode && laneGroups.length > 0 ? (
        laneGroups.map((group) => (
          <div key={group.lane} className="lane-block">
            <h3>{HEALTHY_LANE_LABELS[group.lane]}</h3>
            <ol className="result-list">
              {group.places.map((place) => {
                rankCursor += 1
                return renderCard(place, rankCursor)
              })}
            </ol>
          </div>
        ))
      ) : (
        <ol className="result-list">{filtered.map((place, index) => renderCard(place, index + 1))}</ol>
      )}

      <div className="step-actions row">
        {!(loading && filtered.length === 0) && filtered.length > 0 && (
          <button type="button" className="btn primary" onClick={onSearchAgain}>
            Find more restaurants
          </button>
        )}
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
