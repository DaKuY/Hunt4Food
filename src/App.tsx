import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { cuisineById } from './data/cuisines'
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
import type { CitySelection, CuisineId, DietaryId, RankedRestaurant, TasteProfile } from './lib/types'
import { CuisineStep } from './components/CuisineStep'
import { ResultsStep } from './components/ResultsStep'
import { TastePage } from './components/TastePage'
import './App.css'

const CityStep = lazy(() =>
  import('./components/CityStep').then((m) => ({ default: m.CityStep })),
)

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
        Pick a city on the map, choose up to three cuisines, and get ten ranked spots — with links to
        Google, Yelp, and TripAdvisor reviews.
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
  const [step, setStep] = useState<'city' | 'cuisine' | 'results'>('city')
  const [city, setCity] = useState<CitySelection | null>(null)
  const [cuisines, setCuisines] = useState<CuisineId[]>([])
  const [dietary, setDietary] = useState<DietaryId[]>(taste.dietaryPrefs)
  const [places, setPlaces] = useState<RankedRestaurant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openNowOnly, setOpenNowOnly] = useState(false)
  const [hasWebsiteOnly, setHasWebsiteOnly] = useState(false)
  const [shortlist, setShortlist] = useState<ShortlistItem[]>(() => loadShortlist())

  // Restore from URL when possible
  useEffect(() => {
    const c = params.get('cuisines')
    if (c) {
      const ids = c.split(',').filter(Boolean) as CuisineId[]
      if (ids.length) setCuisines(ids.slice(0, 3))
    }
    const d = params.get('dietary')
    if (d) setDietary(d.split(',').filter(Boolean) as DietaryId[])
  }, [params])

  const runSearch = useCallback(
    async (selection: CitySelection, food: CuisineId[], diet: DietaryId[], signal: AbortSignal) => {
      setLoading(true)
      setError(null)
      setStep('results')
      try {
        const raw = await fetchRestaurants(selection.bounds, food, signal)
        const ranked = rankRestaurants(raw, {
          center: selection.center,
          selectedCuisines: food,
          dietary: diet,
          taste,
          limit: 10,
        })
        setPlaces(ranked)
        if (!ranked.length) {
          setError(null)
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setError('Could not reach OpenStreetMap right now. Try again in a minute, or use Google / Yelp below.')
        setPlaces([])
      } finally {
        setLoading(false)
      }
    },
    [taste],
  )

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
    const ctrl = new AbortController()
    void runSearch(city, cuisines, dietary, ctrl.signal)
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
          onToggleOpenNow={() => setOpenNowOnly((v) => !v)}
          onToggleWebsite={() => setHasWebsiteOnly((v) => !v)}
          lovedIds={lovedIds}
          shortlistedIds={shortlistedIds}
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
            setPlaces((prev) => prev.filter((p) => p.id !== place.id))
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
            setPlaces([])
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
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchFlow />} />
          <Route path="/taste" element={<TasteRoute />} />
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
          . Reviews open on Google, Yelp, and TripAdvisor. Taste profiles stay on your device.
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
