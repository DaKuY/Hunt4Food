import { lazy, Suspense, useEffect, useState } from 'react'
import {
  cityCuisineFallbackLinks,
  googleMapsUrl,
  menuOrWebsiteUrl,
  openTableUrl,
  safeExternalUrl,
  tripadvisorUrl,
  yelpUrl,
} from '../lib/links'
import { HEALTHY_FOCUS_OPTIONS, signalSourceLabel } from '../lib/healthySignals'
import type { PriceLevel } from '../lib/priceRange'
import { FIRST_RESULT_ID, scrollToFirstResult } from '../lib/scroll'
import type { PlaceRatings } from '../lib/ratings'
import { formatDistanceMiles, isProbablyOpenNow } from '../lib/rank'
import type { SeedOilInfo } from '../lib/seedOil'
import { lunchVerdict } from '../lib/lunch'
import { seedOilVerdict } from '../lib/seedOilStatus'
import type { HealthyFocusId, RankedRestaurant } from '../lib/types'
import { RatingsRow } from './RatingsRow'

const ResultsMap = lazy(() =>
  import('./ResultsMap').then((m) => ({ default: m.ResultsMap })),
)

type Props = {
  places: RankedRestaurant[]
  /** The search asked for no seed oils: show each place's verdict and the evidence behind it. */
  seedOilRequired?: boolean
  /** Places removed because they are known to use seed oils. */
  seedOilHiddenCount?: number
  /** "special": the search asked for a lunch special; "open": just lunch service. */
  lunchFilter?: 'special' | 'open' | null
  /** Places removed because their hours show no lunch service. */
  lunchHiddenCount?: number
  onToggleLunchSpecial?: () => void
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
  healthyFocus: HealthyFocusId[]
  onHealthyFocusChange: (focus: HealthyFocusId[]) => void
  maxMiles: number | null
  onMaxMilesChange: (miles: number | null) => void
  priceLevels: PriceLevel[]
  onPriceLevelsChange: (levels: PriceLevel[]) => void
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


const KM_PER_MILE = 1.609
const DISTANCE_CHOICES = [1, 3, 5, 10] as const
const PRICE_CHOICES: PriceLevel[] = [1, 2, 3, 4]

export function ResultsStep({
  places,
  seedOilRequired = false,
  seedOilHiddenCount = 0,
  lunchFilter = null,
  lunchHiddenCount = 0,
  onToggleLunchSpecial,
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
  healthyFocus,
  onHealthyFocusChange,
  maxMiles,
  onMaxMilesChange,
  priceLevels,
  onPriceLevelsChange,
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
    if (hasWebsiteOnly && !p.website) return false
    if (maxMiles != null && p.distanceKm > maxMiles * KM_PER_MILE) return false
    // Price comes from Google/Yelp; places with no price data yet stay listed.
    const level = ratingsMap[p.id]?.price.level
    if (priceLevels.length && level != null && !priceLevels.includes(level)) return false
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
    const distance = formatDistanceMiles(place.distanceKm)
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
            {distance ? ` · ${distance}` : ''}
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
          {seedOilRequired ? <SeedOilLine verdict={seedOilVerdict(place, seedOil)} checking={seedOilLoading && !seedOil} /> : null}
          {lunchFilter === 'special' ? <LunchLine verdict={lunchVerdict(place)} /> : null}
          {seedOil?.grade ? (
            <p className="seed-oil-badge">
              <a href={safeExternalUrl(seedOil.url, 'https://seedoiltracker.com')} target="_blank" rel="noreferrer" title={seedOil.cookingOil ?? undefined}>
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
              <span className="popular-dishes-label">Typical dishes</span>
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

  return (
    <section className="step results-step">
      <header className="step-header">
        <p className="eyebrow">Hunt4Food · {cityLabel}</p>
        <h2>
          {healthyMode
            ? 'Healthy spots worth the hunt'
            : filtered.length && filtered.length < 10
              ? `${filtered.length} ${filtered.length === 1 ? 'place' : 'places'} worth the hunt`
              : 'Ten places worth the hunt'}
        </h2>
        <p className="lede">
          {healthyMode ? (
            <>
              Live search for True Food Kitchen–style restaurants, smoothie spots like Tropical Smoothie and Pure Green, and grass-fed steak, salmon, or chicken
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
      {seedOilRequired && places.length > 0 ? (
        <SeedOilSummary places={places} seedOilMap={seedOilMap} hidden={seedOilHiddenCount} />
      ) : null}
      {lunchFilter && places.length > 0 ? (
        <LunchSummary places={places} hidden={lunchHiddenCount} specialRequired={lunchFilter === 'special'} />
      ) : null}
      {healthyMode && searchStatus ? (
        <p className="healthy-status" aria-live="polite">
          {searchStatus}
        </p>
      ) : null}

      {healthyMode ? (
        <div className="filters chip-row wrap" role="group" aria-label="What kind of healthy">
          <button
            type="button"
            className={`chip healthy ${healthyFocus.length === 0 ? 'on' : ''}`}
            aria-pressed={healthyFocus.length === 0}
            onClick={() => onHealthyFocusChange([])}
          >
            All healthy
          </button>
          {HEALTHY_FOCUS_OPTIONS.map((option) => {
            const on = healthyFocus.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                className={`chip healthy ${on ? 'on' : ''}`}
                aria-pressed={on}
                title={option.hint}
                onClick={() =>
                  onHealthyFocusChange(on ? healthyFocus.filter((f) => f !== option.id) : [...healthyFocus, option.id])
                }
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="filters chip-row wrap" role="group" aria-label="Distance and price">
        {DISTANCE_CHOICES.map((miles) => (
          <button
            key={miles}
            type="button"
            className={`chip ghost ${maxMiles === miles ? 'on' : ''}`}
            aria-pressed={maxMiles === miles}
            onClick={() => onMaxMilesChange(maxMiles === miles ? null : miles)}
          >
            ≤ {miles} mi
          </button>
        ))}
        {PRICE_CHOICES.map((level) => {
          const on = priceLevels.includes(level)
          return (
            <button
              key={level}
              type="button"
              className={`chip ghost ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() =>
                onPriceLevelsChange(on ? priceLevels.filter((l) => l !== level) : [...priceLevels, level].sort())
              }
            >
              {'$'.repeat(level)}
            </button>
          )
        })}
      </div>

      <div className="filters chip-row wrap">
        <button type="button" className={`chip ghost ${openNowOnly ? 'on' : ''}`} onClick={onToggleOpenNow}>
          Prefer open now
        </button>
        {onToggleLunchSpecial ? (
          <button
            type="button"
            className={`chip ghost ${lunchFilter === 'special' ? 'on' : ''}`}
            aria-pressed={lunchFilter === 'special'}
            onClick={onToggleLunchSpecial}
          >
            Lunch special
          </button>
        ) : null}
        <button
          type="button"
          className={`chip ghost ${hasWebsiteOnly ? 'on' : ''}`}
          onClick={onToggleWebsite}
        >
          Has website
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

      {!loading && !error && places.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          <p>None of these {places.length} places match your filters.</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onMaxMilesChange(null)
              onPriceLevelsChange([])
              if (openNowOnly) onToggleOpenNow()
              if (hasWebsiteOnly) onToggleWebsite()
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {!loading && !error && places.length === 0 && (
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

      {healthyMode && !loading && places.length > 0 && places.length < 10 ? (
        <p className="muted small" aria-live="polite">
          Only {places.length} healthy {places.length === 1 ? 'spot' : 'spots'} in this map area
          {healthyFocus.length ? ' for your picks' : ''}. Hunt4Food won&apos;t pad the list with pizza or burgers — zoom
          the map out or choose a neighborhood nearby to see more.
        </p>
      ) : null}
      {filtered.length < places.length && filtered.length > 0 ? (
        <p className="muted small">
          Showing {filtered.length} of {places.length} after your filters.
        </p>
      ) : null}

      <ol className="result-list">{filtered.map((place, index) => renderCard(place, index + 1))}</ol>

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

function SeedOilLine({ verdict, checking }: { verdict: ReturnType<typeof seedOilVerdict>; checking: boolean }) {
  if (verdict.status === 'free') {
    return <p className="seed-oil-verdict free">✓ No seed oils — {verdict.evidence}</p>
  }
  if (checking) return <p className="seed-oil-verdict muted">Checking seed-oil data…</p>
  return <p className="seed-oil-verdict unknown">? Seed oils not verified — ask what they fry in before ordering</p>
}

function SeedOilSummary({
  places,
  seedOilMap,
  hidden,
}: {
  places: RankedRestaurant[]
  seedOilMap: Record<string, SeedOilInfo>
  hidden: number
}) {
  const verified = places.filter((place) => seedOilVerdict(place, seedOilMap[place.id]).status === 'free').length
  return (
    <p className="banner seed-oil-summary" aria-live="polite">
      <strong>No seed oils:</strong> {verified} verified · {places.length - verified} not verified
      {hidden ? ` · ${hidden} hidden (known to use seed oils)` : ''}. Verified means Seed Oil Tracker or a review or
      listing says so (e.g. cooks with lard, tallow or avocado oil). Most restaurants don&apos;t publish their cooking oil,
      so unverified places are shown after verified ones — not as seed-oil free.
    </p>
  )
}

function LunchLine({ verdict }: { verdict: ReturnType<typeof lunchVerdict> }) {
  if (verdict.status === 'special') {
    return <p className="seed-oil-verdict free">🍽 Lunch special — {verdict.evidence}</p>
  }
  return (
    <p className="seed-oil-verdict unknown">
      ? Lunch special not verified{verdict.lunchHours ? ` — open for lunch (${verdict.lunchHours})` : ''} — call or check the menu
    </p>
  )
}

function LunchSummary({
  places,
  hidden,
  specialRequired,
}: {
  places: RankedRestaurant[]
  hidden: number
  specialRequired: boolean
}) {
  const hiddenText = hidden ? ` · ${hidden} hidden (hours show no lunch service)` : ''
  if (!specialRequired) {
    return (
      <p className="banner seed-oil-summary" aria-live="polite">
        <strong>Open for lunch:</strong> places whose hours show no lunch service are hidden{hiddenText}.
      </p>
    )
  }
  const verified = places.filter((place) => lunchVerdict(place).status === 'special').length
  return (
    <p className="banner seed-oil-summary" aria-live="polite">
      <strong>Lunch special:</strong> {verified} verified · {places.length - verified} not verified{hiddenText}. Verified
      means a review, snippet or listing mentions a lunch special or lunch deal (quoted on the card). Few places list
      their specials online, so unverified places are shown after verified ones — not as having a special.
    </p>
  )
}
