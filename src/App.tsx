import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { cuisineById } from './data/cuisines'
import { usePlaceRatings } from './hooks/usePlaceRatings'
import { buildSearchShareUrl } from './lib/links'
import { pruneExpiredCache } from './lib/storage'
import { fetchRestaurants } from './lib/overpass'
import { rankRestaurants } from './lib/rank'
import {
  loadShortlist,
  loadTaste,
  lovePlace,
  saveShortlist,
  setDietaryPrefs,
  skipPlace,
  toggleShortlist,
  type ShortlistItem,
} from './lib/taste'
import type { CitySelection, CuisineId, DietaryId, RankedRestaurant, Restaurant, TasteProfile } from './lib/types'
import { CuisineStep } from './components/CuisineStep'
import { ResultsStep } from './components/ResultsStep'
import { SettingsPage } from './components/SettingsPage'
import { TastePage } from './components/TastePage'
import './App.css'

const CityStep = lazy(() =>
  import('./components/CityStep').then((m) => ({ default: m.CityStep })),
)

function cityFromParams(params: URLSearchParams): CitySelection | null {
  const label = params.get('city')
  const lat = Number(params.get('lat'))
  const lon = Number(params.get('lon'))
  const south = Number(params.get('south'))
  const west = Number(params.get('west'))
  const north = Number(params.get('north'))
  const east = Number(params.get('east'))
  if (!label || ![lat, lon, south, west, north, east].every((n) => Number.isFinite(n))) return null
  return {
    label,
    center: { lat, lon },
    bounds: { south, west, north, east },
    source: 'search',
  }
}

function useTaste() {
  const [taste, setTaste] = useState<TasteProfile>(() => loadTaste())
  return { taste, setTaste }
}

function Home() {
  const navigate = useNavigate()
  return (
    <section className="hero">
      <p className="brand">OpenPlate</p>
      <h1>Find places that actually fit what you like to eat.</h1>
      <p className="hero-lede">
        Pick a city on the map, choose up to three cuisines, and get ten ranked spots — with Google, Yelp,
        and TripAdvisor ratings.
      </p>
      <div className="hero-actions">
        <button type="button" className="btn primary" onClick={() => navigate('/search')}>
          Start searching
        </button>
        <Link className="btn ghost" to="/taste">
          My Taste
        </Link>
      </div>
    </section>
  )
}

function SearchFlow() {
  const [params, setParams] = useSearchParams()
  const { taste, setTaste } = useTaste()
  const restored = cityFromParams(params)
  const initialCuisines = useMemo(() => {
    const c = params.get('cuisines')
    if (!c) return [] as CuisineId[]
    return c.split(',').filter(Boolean).slice(0, 3) as CuisineId[]
  }, [params])

  const [step, setStep] = useState<'city' | 'cuisine' | 'results'>(() => {
    if (restored && initialCuisines.length) return 'results'
    if (restored) return 'cuisine'
    return 'city'
  })
  const [city, setCity] = useState<CitySelection | null>(() => restored)
  const [cuisines, setCuisines] = useState<CuisineId[]>(() => initialCuisines)
  const [dietary, setDietary] = useState<DietaryId[]>(() => {
    const d = params.get('dietary')
    if (d) return d.split(',').filter(Boolean) as DietaryId[]
    return taste.dietaryPrefs
  })
  const [rawPlaces, setRawPlaces] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openNowOnly, setOpenNowOnly] = useState(false)
  const [hasWebsiteOnly, setHasWebsiteOnly] = useState(false)
  const [shortlist, setShortlist] = useState<ShortlistItem[]>(() => loadShortlist())
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const autoRanRef = useRef(false)
  const tasteRef = useRef(taste)
  tasteRef.current = taste

  const places = useMemo(() => {
    if (!city || rawPlaces.length === 0) return [] as RankedRestaurant[]
    return rankRestaurants(rawPlaces, {
      center: city.center,
      selectedCuisines: cuisines,
      dietary,
      taste,
      limit: 10,
    })
  }, [rawPlaces, city, cuisines, dietary, taste])

  const { ratingsMap, ratingsLoading } = usePlaceRatings(places, city?.label ?? '', step === 'results' && places.length > 0)

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort()
    }
  }, [])

  const runSearch = useCallback(
    async (selection: CitySelection, food: CuisineId[]) => {
      searchAbortRef.current?.abort()
      const ctrl = new AbortController()
      searchAbortRef.current = ctrl
      setLoading(true)
      setError(null)
      setStep('results')
      setRawPlaces([])
      try {
        const raw = await fetchRestaurants(selection.bounds, food, ctrl.signal)
        if (ctrl.signal.aborted) return
        setRawPlaces(raw)
      } catch (e) {
        if ((e as Error).name === 'AbortError' || ctrl.signal.aborted) return
        setError('Could not reach OpenStreetMap right now. Try again in a minute, or use Google / Yelp below.')
        setRawPlaces([])
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    },
    [],
  )

  // Auto-run when shared URL has city + cuisines
  useEffect(() => {
    if (autoRanRef.current || !restored || initialCuisines.length === 0) return
    autoRanRef.current = true
    void runSearch(restored, initialCuisines)
  }, [restored, initialCuisines, runSearch])

  function confirmCity(selection: CitySelection) {
    setCity(selection)
    setStep('cuisine')
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('city', selection.label)
      next.set('lat', String(selection.center.lat))
      next.set('lon', String(selection.center.lon))
      next.set('south', String(selection.bounds.south))
      next.set('west', String(selection.bounds.west))
      next.set('north', String(selection.bounds.north))
      next.set('east', String(selection.bounds.east))
      return next
    })
  }

  function startFind() {
    if (!city || cuisines.length === 0) return
    setTaste(setDietaryPrefs(taste, dietary))
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('cuisines', cuisines.join(','))
      next.set('dietary', dietary.join(','))
      return next
    })
    void runSearch(city, cuisines)
  }

  async function copySearchLink() {
    try {
      await navigator.clipboard.writeText(buildSearchShareUrl(params))
      setShareMessage('Search link copied — send it to a friend!')
    } catch {
      setShareMessage(buildSearchShareUrl(params))
    }
  }

  const cuisineLabels = useMemo(
    () => cuisines.map((id) => cuisineById(id).label),
    [cuisines],
  )

  const lovedIds = useMemo(() => new Set(taste.loved.map((l) => l.id)), [taste.loved])
  const shortlistedIds = useMemo(() => new Set(shortlist.map((s) => s.id)), [shortlist])

  return (
    <>
      {step === 'city' && (
        <Suspense fallback={<p className="muted">Loading map…</p>}>
          <CityStep onConfirm={confirmCity} initial={city} />
        </Suspense>
      )}
      {step === 'cuisine' && city && (
        <CuisineStep
          cityLabel={city.label}
          selected={cuisines}
          dietary={dietary}
          onChange={setCuisines}
          onDietaryChange={setDietary}
          onBack={() => setStep('city')}
          onNext={startFind}
        />
      )}
      {step === 'results' && city && (
        <ResultsStep
          places={places}
          cityLabel={city.label}
          cityCenter={city.center}
          cuisineLabels={cuisineLabels}
          loading={loading}
          error={error}
          openNowOnly={openNowOnly}
          hasWebsiteOnly={hasWebsiteOnly}
          ratingsMap={ratingsMap}
          ratingsLoading={ratingsLoading}
          onToggleOpenNow={() => setOpenNowOnly((v) => !v)}
          onToggleWebsite={() => setHasWebsiteOnly((v) => !v)}
          lovedIds={lovedIds}
          shortlistedIds={shortlistedIds}
          shareMessage={shareMessage}
          onCopySearchLink={() => void copySearchLink()}
          onRetry={() => void runSearch(city, cuisines)}
          onLove={(place) => {
            setTaste(
              lovePlace(taste, {
                id: place.id,
                name: place.name,
                city: city.label,
                cuisines: place.cuisines,
                rating: 5,
                vibeTags: [],
              }),
            )
          }}
          onSkip={(place) => {
            setTaste(
              skipPlace(taste, {
                id: place.id,
                name: place.name,
                city: city.label,
                cuisines: place.cuisines,
                rating: 1,
                vibeTags: [],
              }),
            )
            setRawPlaces((prev) => prev.filter((p) => p.id !== place.id))
          }}
          onShortlist={(place) => {
            setShortlist(
              toggleShortlist(shortlist, {
                id: place.id,
                name: place.name,
                lat: place.lat,
                lon: place.lon,
                city: city.label,
              }),
            )
          }}
          onBack={() => setStep('cuisine')}
          onNewSearch={() => {
            setStep('city')
            setRawPlaces([])
            autoRanRef.current = false
          }}
        />
      )}
    </>
  )
}

function TasteRoute() {
  const { taste, setTaste } = useTaste()
  const [shortlist, setShortlist] = useState<ShortlistItem[]>(() => loadShortlist())
  const shareUrl = useMemo(() => {
    const payload = encodeURIComponent(JSON.stringify(shortlist))
    return `${window.location.origin}${window.location.pathname}#/shortlist?data=${payload}`
  }, [shortlist])

  return (
    <TastePage
      taste={taste}
      onTasteChange={setTaste}
      shortlist={shortlist}
      onClearShortlist={() => {
        saveShortlist([])
        setShortlist([])
      }}
      shareUrl={shareUrl}
    />
  )
}

function ShortlistView() {
  const [params] = useSearchParams()
  const items = useMemo(() => {
    try {
      const raw = params.get('data')
      if (!raw) return []
      return JSON.parse(decodeURIComponent(raw)) as ShortlistItem[]
    } catch {
      return []
    }
  }, [params])

  return (
    <section className="step">
      <header className="step-header">
        <p className="eyebrow">Shared shortlist</p>
        <h2>Places to try</h2>
      </header>
      {items.length === 0 ? (
        <p className="muted">No places in this link.</p>
      ) : (
        <ul className="taste-list">
          {items.map((i) => (
            <li key={i.id}>
              <strong>{i.name}</strong>
              {i.city && <span className="muted"> · {i.city}</span>}
            </li>
          ))}
        </ul>
      )}
      <Link className="btn primary" to="/search">
        Start your own search
      </Link>
    </section>
  )
}

function Shell() {
  useEffect(() => {
    pruneExpiredCache()
  }, [])

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden />
      <header className="topbar">
        <Link to="/" className="top-brand">
          OpenPlate
        </Link>
        <nav>
          <Link to="/search">Search</Link>
          <Link to="/taste">My Taste</Link>
          <Link to="/settings">Settings</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchFlow />} />
          <Route path="/taste" element={<TasteRoute />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/shortlist" element={<ShortlistView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <p>
          Place data ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap contributors
          </a>
          . Ratings from Google, Yelp, and TripAdvisor when available. Taste profiles stay on your device.
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
