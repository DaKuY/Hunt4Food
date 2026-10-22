import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { cuisineById, isKnownCuisineId, isKnownDietaryId, normalizeCuisineSelection } from './data/cuisines'
import { usePlaceDishes } from './hooks/usePlaceDishes'
import { usePlaceRatings } from './hooks/usePlaceRatings'
import { usePlaceSeedOil } from './hooks/usePlaceSeedOil'
import { buildSearchShareUrl } from './lib/links'
import { coordsToCitySelection, searchCities, type GeocodeHit } from './lib/geocode'
import { describeParsedQuery, parseSearchQuery } from './lib/queryParser'
import { lunchVerdict } from './lib/lunch'
import { applyRequirements } from './lib/seedOilStatus'
import { ensureCacheGeneration, pruneExpiredCache } from './lib/storage'
import { attachSeedOilSignals, mineReviewEvidence, pickHealthyLanes, runHealthyHunt, type HealthyPrefs } from './lib/healthySearch'
import { isHealthyFocusId } from './lib/healthySignals'
import type { PriceLevel } from './lib/priceRange'
import { fetchRestaurants } from './lib/overpass'
import { discoverProviderCandidates, lunchSpecialTerms, mergeProviderCandidates } from './lib/providerDiscovery'
import { rankRestaurants } from './lib/rank'
import { ratingQualityAdjustment } from './lib/ratings'
import { seedOilGradeScore } from './lib/seedOil'
import {
  loadRecentCities,
  loadShortlist,
  loadTaste,
  lovePlace,
  pushRecentCity,
  recentToCitySelection,
  saveShortlist,
  setDietaryPrefs,
  skipPlace,
  toggleShortlist,
  type ShortlistItem,
} from './lib/taste'
import type { CitySelection, CuisineId, DietaryId, HealthyFocusId, MapBounds, RankedRestaurant, Restaurant, TasteProfile } from './lib/types'
import { AskBar } from './components/AskBar'
import { CuisineStep } from './components/CuisineStep'
import { ResultsStep } from './components/ResultsStep'
import { SettingsPage } from './components/SettingsPage'
import { TastePage } from './components/TastePage'
import { BrandMark, brandAriaLabel } from './components/BrandMark'
import { leaveToLodge, LODGE_HOME } from './lib/lodgeHome'
import './App.css'

const CityStep = lazy(() =>
  import('./components/CityStep').then((m) => ({ default: m.CityStep })),
)

type LunchFilter = 'special' | 'open' | null

type SearchNavState = {
  onNewCity: () => void
  showNewCity: boolean
}

const SearchNavContext = createContext<{
  searchNav: SearchNavState | null
  setSearchNav: (state: SearchNavState | null) => void
} | null>(null)

function useSearchNav() {
  const ctx = useContext(SearchNavContext)
  if (!ctx) throw new Error('useSearchNav must be used within SearchNavContext')
  return ctx
}

/** First Hunt4Food screen: browser Back must leave for the lodge, not remount this SPA. */
function useLeaveToLodgeOnBrowserBack(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onPopState = () => {
      leaveToLodge()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [enabled])
}

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

/** "Near Coppell TX": the place's centre with its area capped at about ±5 miles, so a big city's full extent doesn't swamp the search. */
function nearSelection(hit: GeocodeHit): CitySelection {
  const span = 0.08
  return {
    label: hit.label,
    center: { lat: hit.lat, lon: hit.lon },
    bounds: {
      south: Math.max(hit.south, hit.lat - span),
      north: Math.min(hit.north, hit.lat + span),
      west: Math.max(hit.west, hit.lon - span),
      east: Math.min(hit.east, hit.lon + span),
    },
    source: 'search',
  }
}

function currentPosition(timeoutMs = 10000): Promise<GeolocationPosition | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: false,
      timeout: timeoutMs,
      maximumAge: 600000,
    })
  })
}

function useTaste() {
  const [taste, setTaste] = useState<TasteProfile>(() => loadTaste())
  return { taste, setTaste }
}

function hasSearchCriteria(cuisines: CuisineId[], keyword: string): boolean {
  return cuisines.length > 0 || keyword.trim().length > 0
}

function SearchFlow() {
  const { setSearchNav } = useSearchNav()
  const [params, setParams] = useSearchParams()
  // Several URL updates in one event (new city, then filters) must build on each other:
  // React Router's functional setParams only sees the last rendered params, so a second
  // update in the same tick would put the old city back.
  const paramsRef = useRef(params)
  paramsRef.current = params
  const pendingParamsRef = useRef<URLSearchParams | null>(null)
  useEffect(() => {
    pendingParamsRef.current = null
  }, [params])
  const updateParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(pendingParamsRef.current ?? paramsRef.current)
      mutate(next)
      pendingParamsRef.current = next
      setParams(next, { replace: true })
    },
    [setParams],
  )
  const { taste, setTaste } = useTaste()
  const restored = cityFromParams(params)
  const initialRecentRef = useRef(restored ? null : loadRecentCities()[0])
  const initialRecent = initialRecentRef.current
  const initialCuisines = useMemo(() => {
    const c = params.get('cuisines')
    if (!c) return [] as CuisineId[]
    return normalizeCuisineSelection(
      c.split(',').filter((id) => isKnownCuisineId(id)) as CuisineId[],
    )
  }, [params])

  const [step, setStep] = useState<'city' | 'cuisine' | 'results'>(() => {
    const restoredKeyword = (params.get('keyword') ?? '').trim()
    if (restored && (initialCuisines.length > 0 || restoredKeyword)) return 'results'
    if (restored || initialRecent) return 'cuisine'
    return 'city'
  })
  const [city, setCity] = useState<CitySelection | null>(
    () => restored ?? (initialRecent ? recentToCitySelection(initialRecent) : null),
  )
  const [resolvingLocation, setResolvingLocation] = useState(
    () => !restored && !initialRecent && typeof navigator !== 'undefined' && 'geolocation' in navigator,
  )
  const [cuisines, setCuisines] = useState<CuisineId[]>(() => initialCuisines)
  const [dietary, setDietary] = useState<DietaryId[]>(() => {
    const d = params.get('dietary')
    if (d) return d.split(',').filter((id) => isKnownDietaryId(id)) as DietaryId[]
    return taste.dietaryPrefs
  })
  const [healthyFocus, setHealthyFocus] = useState<HealthyFocusId[]>(
    () => (params.get('focus') ?? '').split(',').filter(isHealthyFocusId),
  )
  const healthyFocusRef = useRef(healthyFocus)
  healthyFocusRef.current = healthyFocus
  // "no smoothies" (avoid) and "fast lunch" (quick) from a typed search.
  const [healthyPrefs, setHealthyPrefs] = useState<HealthyPrefs>(() => ({
    avoid: (params.get('avoid') ?? '').split(',').filter(isHealthyFocusId),
    quick: params.get('quick') === '1',
  }))
  const healthyPrefsRef = useRef(healthyPrefs)
  healthyPrefsRef.current = healthyPrefs
  // "with a lunch special" (verified specials first) or plain "lunch" (hide dinner-only places).
  const [lunchFilter, setLunchFilter] = useState<LunchFilter>(() => {
    const value = params.get('lunch')
    return value === 'special' || value === 'open' ? value : null
  })
  const lunchFilterRef = useRef(lunchFilter)
  lunchFilterRef.current = lunchFilter
  const [maxMiles, setMaxMiles] = useState<number | null>(null)
  const [asking, setAsking] = useState(false)
  const [askMessage, setAskMessage] = useState<{ kind: 'understood' | 'problem'; text: string } | null>(null)
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([])
  const [keyword, setKeyword] = useState(() => params.get('keyword') ?? '')
  const [rawPlaces, setRawPlaces] = useState<Restaurant[]>([])
  const [displayPlaces, setDisplayPlaces] = useState<RankedRestaurant[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set())
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openNowOnly, setOpenNowOnly] = useState(false)
  const [hasWebsiteOnly, setHasWebsiteOnly] = useState(false)
  const [shortlist, setShortlist] = useState<ShortlistItem[]>(() => loadShortlist())
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [healthyStatus, setHealthyStatus] = useState<string | null>(null)
  const [scrollToResultsKey, setScrollToResultsKey] = useState(0)
  const [cityPickedByUser, setCityPickedByUser] = useState(false)
  const searchAbortRef = useRef<AbortController | null>(null)
  const prefetchPromiseRef = useRef<Promise<Restaurant[]> | null>(null)
  const poolRef = useRef<Restaurant[]>([])
  const healthyPoolRef = useRef<RankedRestaurant[]>([])
  const autoRanRef = useRef(false)
  const tasteRef = useRef(taste)
  tasteRef.current = taste

  const schedulePrefetch = useCallback((bounds: MapBounds) => {
    prefetchPromiseRef.current = null
    const promise: Promise<Restaurant[]> = fetchRestaurants(bounds)
      .then((raw) => {
        // A slower prefetch for the previous city must not overwrite the new city's pool.
        if (prefetchPromiseRef.current === promise) {
          poolRef.current = raw
          setRawPlaces(raw)
        }
        return raw
      })
      .catch((err) => {
        if (prefetchPromiseRef.current === promise) prefetchPromiseRef.current = null
        throw err
      })
    // Background prefetch: a failure is handled when a search awaits it, so do not report it as unhandled.
    promise.catch(() => {})
    prefetchPromiseRef.current = promise
  }, [])

  const loadRestaurantPool = useCallback(async (bounds: MapBounds, signal?: AbortSignal): Promise<Restaurant[]> => {
    if (poolRef.current.length) return poolRef.current

    const prefetch = prefetchPromiseRef.current
    if (prefetch) {
      try {
        return await prefetch
      } catch {
        prefetchPromiseRef.current = null
      }
    }

    return fetchRestaurants(bounds, signal)
  }, [])

  const requireNoSeedOils = dietary.includes('no_seed_oils')

  const healthyMode = cuisines.includes('healthy')
  const places = displayPlaces
  const { ratingsMap, ratingsLoading } = usePlaceRatings(
    places,
    city?.label ?? '',
    step === 'results' && places.length > 0,
    { skipGoogle: healthyMode },
  )
  const { seedOilMap, seedOilLoading } = usePlaceSeedOil(
    places,
    step === 'results' && places.length > 0 && (requireNoSeedOils || healthyMode),
  )
  // "No seed oils": hide places known to use them; verified seed-oil-free places first.
  // "Lunch special": hide places whose hours show no lunch; verified specials first.
  const lunchSpecialOnly = lunchFilter === 'special'
  const shownPlaces = useMemo(
    () =>
      applyRequirements(
        places,
        { noSeedOils: requireNoSeedOils, lunchSpecial: lunchSpecialOnly, lunchService: lunchFilter === 'open' },
        seedOilMap,
      ),
    [requireNoSeedOils, lunchSpecialOnly, lunchFilter, places, seedOilMap],
  )
  const hiddenCounts = useMemo(() => {
    if (shownPlaces === places) return { seedOil: 0, lunch: 0 }
    const shownIds = new Set(shownPlaces.map((p) => p.id))
    const hidden = places.filter((p) => !shownIds.has(p.id))
    const lunch = hidden.filter((p) => lunchVerdict(p).status === 'no_lunch').length
    return { seedOil: hidden.length - lunch, lunch }
  }, [places, shownPlaces])

  // Outside healthy mode nothing reads reviews, so fetch them once per place for seed-oil and
  // lunch-special evidence (lard, tallow, avocado oil, "fried in canola oil", "lunch special").
  const minedIdsRef = useRef(new Set<string>())
  const cityLabelRef = useRef(city?.label ?? '')
  cityLabelRef.current = city?.label ?? ''
  useEffect(() => {
    if ((!requireNoSeedOils && !lunchSpecialOnly) || healthyMode || step !== 'results' || !city) return
    const pending = displayPlaces.filter((p) => p.yelpId && !minedIdsRef.current.has(p.id))
    if (!pending.length) return
    pending.forEach((p) => minedIdsRef.current.add(p.id))
    const label = city.label
    void mineReviewEvidence(pending, label).then((mined) => {
      if (cityLabelRef.current !== label) return
      const byId = new Map(mined.map((p) => [p.id, p]))
      setDisplayPlaces((prev) =>
        prev.map((p) => {
          const m = byId.get(p.id)
          return m && m.evidenceText !== undefined
            ? { ...p, signals: m.signals, evidenceText: m.evidenceText, evidenceQuote: m.evidenceQuote, reasons: m.reasons }
            : p
        }),
      )
    })
  }, [requireNoSeedOils, lunchSpecialOnly, healthyMode, step, city, displayPlaces])
  const { dishesMap, dishesLoading } = usePlaceDishes(
    places,
    city?.label ?? '',
    cuisines,
    step === 'results' && places.length > 0,
  )

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (displayPlaces.length === 0) return
    const hasRatings = displayPlaces.some((place) => {
      const ratings = ratingsMap[place.id]
      return Boolean(
        ratings &&
          [ratings.google, ratings.yelp, ratings.tripadvisor].some((source) => source.rating != null),
      )
    })
    if (!hasRatings) return

    setDisplayPlaces((prev) => {
      const scored = prev.map((place) => {
        const previousAdjustment = place.ratingAdjustment ?? 0
        const baseScore = place.score - previousAdjustment
        const quality = ratingQualityAdjustment(ratingsMap[place.id])
        const reasons = place.reasons.filter(
          (reason) =>
            !reason.startsWith('Strong public ratings') &&
            !reason.startsWith('Mixed public ratings'),
        )
        if (quality.reason) reasons.unshift(quality.reason)
        return {
          ...place,
          score: baseScore + quality.points,
          ratingAdjustment: quality.points,
          reasons: reasons.slice(0, 4),
        }
      })

      return healthyMode
        ? pickHealthyLanes(scored, scored.length, undefined, [], healthyPrefsRef.current)
        : [...scored].sort((a, b) => b.score - a.score)
    })
  }, [ratingsMap, healthyMode, displayPlaces.length])

  useEffect(() => {
    if ((!dietary.includes('no_seed_oils') && !healthyMode) || seedOilLoading || displayPlaces.length === 0) return
    const hasGrade = displayPlaces.some((p) => seedOilMap[p.id]?.grade)
    if (!hasGrade) return

    setDisplayPlaces((prev) => {
      const scored = prev.map((p) => {
        const info = seedOilMap[p.id]
        const previousAdjustment = p.seedOilAdjustment ?? 0
        const baseScore = p.score - previousAdjustment
        if (!info?.grade) {
          return previousAdjustment === 0 ? p : { ...p, score: baseScore, seedOilAdjustment: 0 }
        }

        const boost = seedOilGradeScore(info.grade)
        const reasons = [...p.reasons]
        const msg =
          boost > 0
            ? `Seed Oil Tracker grade ${info.grade} — lower seed-oil risk`
            : `Seed Oil Tracker grade ${info.grade} — higher seed-oil use`
        const withoutOldSeedOil = reasons.filter((r) => !r.includes('Seed Oil Tracker'))
        if (boost !== 0) withoutOldSeedOil.unshift(msg)

        return {
          ...p,
          score: baseScore + boost,
          seedOilAdjustment: boost,
          reasons: withoutOldSeedOil.slice(0, 4),
        }
      })

      const withSignals = attachSeedOilSignals(scored, seedOilMap)
      return healthyMode
        ? pickHealthyLanes(withSignals, withSignals.length, undefined, [], healthyPrefsRef.current)
        : [...withSignals].sort((a, b) => b.score - a.score)
    })
  }, [dietary, healthyMode, seedOilMap, seedOilLoading, displayPlaces.length])

  const runSearch = useCallback(
    async (selection: CitySelection, food: CuisineId[], dietaryPrefs: DietaryId[], searchKeyword: string) => {
      const ctrl = new AbortController()
      searchAbortRef.current?.abort()
      searchAbortRef.current = ctrl
      setError(null)
      setStep('results')
      setFavoriteIds(new Set())
      setSeenIds(new Set())
      setHealthyStatus(null)
      healthyPoolRef.current = []

      if (food.includes('healthy')) {
        setLoading(true)
        setDisplayPlaces([])
        setHealthyStatus('Searching nearby, then reading reviews for grass-fed, clean oils, and healthy picks…')
        try {
          const juicePromise = fetchRestaurants(selection.bounds, ctrl.signal, { includeJuiceShops: true }).then(
            (raw) => {
              poolRef.current = raw
              setRawPlaces(raw)
              return raw
            },
          )
          const osm = await juicePromise
          if (ctrl.signal.aborted) return
          const result = await runHealthyHunt({
            city: selection,
            selectedCuisines: food,
            dietary: dietaryPrefs,
            keyword: searchKeyword,
            taste: tasteRef.current,
            osmPlaces: osm,
            focus: healthyFocusRef.current,
            prefs: healthyPrefsRef.current,
            extraDiscoveryTerms: lunchFilterRef.current === 'special' ? lunchSpecialTerms(food) : [],
            signal: ctrl.signal,
            onProgress: (update) => {
              if (ctrl.signal.aborted) return
              setHealthyStatus(update.status)
              if (update.places?.length) {
                setDisplayPlaces(update.places)
                setSeenIds(new Set(update.places.map((p) => p.id)))
                setLoading(false)
              }
            },
          })
          if (ctrl.signal.aborted) return
          healthyPoolRef.current = result.pool
          setDisplayPlaces(result.displayed)
          setSeenIds(new Set(result.displayed.map((p) => p.id)))
          setLoading(false)
        } catch (e) {
          if ((e as Error).name === 'AbortError' || ctrl.signal.aborted) return
          setError('Could not finish the healthy search. Try again, or use Google / Yelp below.')
          setLoading(false)
        }
        return
      }

      const rankPool = (raw: Restaurant[]) => {
        poolRef.current = raw
        setRawPlaces(raw)
        const ranked = rankRestaurants(raw, {
          onlyMatchingCuisines: true,
          center: selection.center,
          selectedCuisines: food,
          dietary: dietaryPrefs,
          keyword: searchKeyword,
          taste: tasteRef.current,
          limit: 10,
        })
        setDisplayPlaces(ranked)
        setSeenIds(new Set(ranked.map((p) => p.id)))
        if (ranked.length) setLoading(false)
        return ranked
      }

      const providerPromise = discoverProviderCandidates(
        selection,
        food,
        searchKeyword,
        ctrl.signal,
        lunchFilterRef.current === 'special' ? lunchSpecialTerms(food) : [],
      ).catch(() => [])

      let osmPlaces = poolRef.current
      let osmFailed = false

      if (osmPlaces.length) {
        rankPool(osmPlaces)
      } else {
        setLoading(true)
        setDisplayPlaces([])
        try {
          osmPlaces = await loadRestaurantPool(selection.bounds, ctrl.signal)
          if (ctrl.signal.aborted) return
          if (osmPlaces.length) rankPool(osmPlaces)
        } catch (e) {
          if ((e as Error).name === 'AbortError' || ctrl.signal.aborted) return
          osmFailed = true
          osmPlaces = []
        }
      }

      const providerCandidates = await providerPromise
      if (ctrl.signal.aborted) return

      const merged = mergeProviderCandidates(osmPlaces, providerCandidates, selection.label)
      if (merged.length) {
        rankPool(merged)
        return
      }

      setRawPlaces([])
      setDisplayPlaces([])
      setLoading(false)
      setError(
        osmFailed
          ? 'Could not reach restaurant data providers right now. Try again in a minute, or use Google / Yelp below.'
          : 'No matching restaurants were found in this area. Try a broader search or use Google / Yelp below.',
      )
    },
    [loadRestaurantPool],
  )

  const searchAgain = useCallback(async () => {
    // No food picked is fine here: that's an "any restaurant" search from the ask bar.
    if (!city) return
    searchAbortRef.current?.abort()
    const ctrl = new AbortController()
    searchAbortRef.current = ctrl
    setLoading(true)
    setError(null)

    const favorites = displayPlaces.filter((p) => favoriteIds.has(p.id))
    const nextSeen = new Set(seenIds)
    displayPlaces.forEach((p) => {
      if (!favoriteIds.has(p.id)) nextSeen.add(p.id)
    })
    favorites.forEach((p) => nextSeen.add(p.id))

    try {
      let pool = poolRef.current.length ? poolRef.current : rawPlaces
      if (pool.length === 0) {
        pool = await loadRestaurantPool(city.bounds, ctrl.signal)
        if (ctrl.signal.aborted) return
        poolRef.current = pool
        setRawPlaces(pool)
      }

      const slots = Math.max(0, 10 - favorites.length)
      const fresh =
        slots > 0
          ? cuisines.includes('healthy') && healthyPoolRef.current.length
            ? pickHealthyLanes(healthyPoolRef.current, slots, nextSeen, healthyFocus, healthyPrefsRef.current)
            : rankRestaurants(pool, {
                onlyMatchingCuisines: true,
                center: city.center,
                selectedCuisines: cuisines,
                dietary,
                keyword,
                taste,
                limit: slots + 15,
                excludeIds: nextSeen,
              }).slice(0, slots)
          : []

      fresh.forEach((p) => nextSeen.add(p.id))
      setDisplayPlaces([...favorites, ...fresh])
      setSeenIds(nextSeen)
      setFavoriteIds(new Set(favorites.map((p) => p.id)))
    } catch (e) {
      if ((e as Error).name === 'AbortError' || ctrl.signal.aborted) return
      setError('Could not fetch more places. Try again in a minute.')
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false)
        setScrollToResultsKey((k) => k + 1)
      }
    }
  }, [city, cuisines, dietary, keyword, taste, displayPlaces, favoriteIds, seenIds, rawPlaces, loadRestaurantPool, healthyFocus])

  useEffect(() => {
    if (!city) return
    schedulePrefetch(city.bounds)
  }, [city, schedulePrefetch])

  // Auto-run when shared URL has city + cuisines or keyword
  useEffect(() => {
    if (autoRanRef.current || !restored || !hasSearchCriteria(initialCuisines, params.get('keyword') ?? '')) return
    autoRanRef.current = true
    void runSearch(restored, initialCuisines, dietary, keyword)
  }, [restored, initialCuisines, dietary, keyword, runSearch, params])

  function confirmCity(selection: CitySelection, pickedByUser = false) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    pushRecentCity({
      label: selection.label,
      lat: selection.center.lat,
      lon: selection.center.lon,
      ...selection.bounds,
    })
    if (pickedByUser) setCityPickedByUser(true)
    setCity(selection)
    setStep('cuisine')
    setResolvingLocation(false)
    poolRef.current = []
    // A search started right away (typed search) must not await the previous city's prefetch.
    prefetchPromiseRef.current = null
    setRawPlaces([])
    updateParams((next) => {
      next.set('city', selection.label)
      next.set('lat', String(selection.center.lat))
      next.set('lon', String(selection.center.lon))
      next.set('south', String(selection.bounds.south))
      next.set('west', String(selection.bounds.west))
      next.set('north', String(selection.bounds.north))
      next.set('east', String(selection.bounds.east))
    })
  }

  useEffect(() => {
    if (!initialRecent || restored) return
    updateParams((next) => {
      if (next.get('city')) return
      next.set('city', initialRecent.label)
      next.set('lat', String(initialRecent.lat))
      next.set('lon', String(initialRecent.lon))
      next.set('south', String(initialRecent.south))
      next.set('west', String(initialRecent.west))
      next.set('north', String(initialRecent.north))
      next.set('east', String(initialRecent.east))
    })
  }, [initialRecent, restored, updateParams])

  useEffect(() => {
    if (restored || initialRecent || !resolvingLocation) return

    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return
        try {
          const selection = await coordsToCitySelection(pos.coords.latitude, pos.coords.longitude)
          if (!cancelled) confirmCity(selection)
        } catch {
          // Reverse geocoding failed: fall back to the manual city step.
        } finally {
          if (!cancelled) setResolvingLocation(false)
        }
      },
      () => {
        if (!cancelled) setResolvingLocation(false)
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    )

    return () => {
      cancelled = true
    }
  }, [restored, initialRecent, resolvingLocation])

  function changeDietary(next: DietaryId[]) {
    setDietary(next)
    setTaste(setDietaryPrefs(taste, next))
  }

  /** On results, re-pick from the healthy pool already fetched: no new search needed. */
  function changeHealthyFocus(next: HealthyFocusId[], nextPrefs?: HealthyPrefs) {
    // "All healthy" also drops "no smoothies"; picking Smoothies lifts that one exclusion.
    const prefs: HealthyPrefs = nextPrefs ?? {
      ...healthyPrefs,
      avoid: next.length ? (healthyPrefs.avoid ?? []).filter((id) => !next.includes(id)) : [],
    }
    setHealthyFocus(next)
    setHealthyPrefs(prefs)
    healthyPrefsRef.current = prefs
    updateParams((params) => {
      if (next.length) params.set('focus', next.join(','))
      else params.delete('focus')
      writePrefsParams(params, prefs)
    })
    if (step === 'results' && healthyPoolRef.current.length) {
      const picked = pickHealthyLanes(healthyPoolRef.current, 10, undefined, next, prefs)
      setDisplayPlaces(picked)
      setSeenIds(new Set(picked.map((p) => p.id)))
      setFavoriteIds(new Set())
    }
  }

  function writePrefsParams(params: URLSearchParams, prefs: HealthyPrefs) {
    if (prefs.avoid?.length) params.set('avoid', prefs.avoid.join(','))
    else params.delete('avoid')
    if (prefs.quick) params.set('quick', '1')
    else params.delete('quick')
  }

  function writeSearchParams(
    food: CuisineId[],
    diet: DietaryId[],
    kw: string,
    focus: HealthyFocusId[],
    lunch: LunchFilter = lunchFilterRef.current,
    prefs: HealthyPrefs = healthyPrefsRef.current,
  ) {
    updateParams((next) => {
      writePrefsParams(next, food.includes('healthy') ? prefs : {})
      if (lunch) next.set('lunch', lunch)
      else next.delete('lunch')
      if (food.length) next.set('cuisines', food.join(','))
      else next.delete('cuisines')
      next.set('dietary', diet.join(','))
      if (food.includes('healthy') && focus.length) next.set('focus', focus.join(','))
      else next.delete('focus')
      const trimmed = kw.trim()
      if (trimmed) next.set('keyword', trimmed)
      else next.delete('keyword')
    })
  }

  /** Plain-language search: parse, find the place, set every filter, then search. */
  async function askSearch(text: string, picked: CuisineId[] = cuisines) {
    const parsed = parseSearchQuery(text)
    // "in Dallas" typed under foods already picked with the chips keeps those foods.
    if (!parsed.cuisines.length && !parsed.healthy && !parsed.keyword && picked.length) {
      parsed.healthy = picked.includes('healthy')
      parsed.cuisines = picked.filter((id) => id !== 'healthy')
    }
    // "food in Grapevine TX": a place with no food named means the best restaurants there.
    const anyFood = !parsed.cuisines.length && !parsed.healthy && !parsed.keyword
    if (anyFood && !parsed.location && !parsed.nearMe) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setAskMessage({
        kind: 'problem',
        text: parsed.lunch
          ? 'Add a food with the lunch, e.g. “healthy lunch special near Coppell TX”.'
          : 'Add a food or dish, e.g. “Mexican near Coppell TX without seed oils”.',
      })
      return
    }
    setAsking(true)
    setAskMessage(null)
    try {
      let selection = city
      if (parsed.location) {
        const hits = await searchCities(parsed.location).catch(() => [] as GeocodeHit[])
        if (!hits.length) {
          setAskMessage({ kind: 'problem', text: `Couldn’t find “${parsed.location}”. Try “City, ST”, e.g. “Coppell, TX”.` })
          return
        }
        selection = nearSelection(hits[0]!)
      } else if (parsed.nearMe || !selection) {
        const pos = await currentPosition()
        if (pos) selection = await coordsToCitySelection(pos.coords.latitude, pos.coords.longitude)
      }
      if (!selection) {
        setAskMessage({ kind: 'problem', text: 'Where? Add “near <city>”, or allow location access.' })
        return
      }

      const food = normalizeCuisineSelection(parsed.healthy ? ['healthy', ...parsed.cuisines] : parsed.cuisines)
      const diet = Array.from(new Set([...dietary, ...parsed.dietary]))
      const kw = parsed.keyword
      const lunch: LunchFilter = parsed.lunchSpecial ? 'special' : parsed.lunch ? 'open' : null
      if (selection !== city) confirmCity(selection, true)
      setCuisines(food)
      setDietary(diet)
      setKeyword(kw)
      setHealthyFocus(parsed.healthyFocus)
      healthyFocusRef.current = parsed.healthyFocus
      setMaxMiles(parsed.maxMiles)
      setPriceLevels(parsed.priceLevels)
      setOpenNowOnly(parsed.openNow)
      setLunchFilter(lunch)
      lunchFilterRef.current = lunch
      const prefs: HealthyPrefs = { avoid: parsed.healthyAvoid, quick: parsed.quick }
      setHealthyPrefs(prefs)
      healthyPrefsRef.current = prefs
      writeSearchParams(food, diet, kw, parsed.healthyFocus, lunch, prefs)
      setAskMessage({
        kind: 'understood',
        text: [
          ...(anyFood ? ['Restaurants'] : []),
          ...describeParsedQuery({ ...parsed, location: null, nearMe: false }, (id) => cuisineById(id).label),
          `near ${selection.label}`,
        ].join(' · '),
      })
      setScrollToResultsKey((k) => k + 1)
      await runSearch(selection, food, diet, kw)
    } finally {
      setAsking(false)
    }
  }

  function startFind() {
    // "healthy food in Coppell TX" typed in the keyword box: move there and search, like the ask bar.
    if (keyword.trim() && parseSearchQuery(keyword).location) {
      void askSearch(keyword, cuisines)
      return
    }
    if (!city || !hasSearchCriteria(cuisines, keyword)) return
    setScrollToResultsKey((k) => k + 1)
    writeSearchParams(cuisines, dietary, keyword, healthyFocus)
    setAskMessage(null)
    void runSearch(city, cuisines, dietary, keyword)
  }

  const startNewCitySearch = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    searchAbortRef.current?.abort()
    setStep('city')
    setCity(null)
    setCuisines([])
    setKeyword('')
    setRawPlaces([])
    setDisplayPlaces([])
    setFavoriteIds(new Set())
    setSeenIds(new Set())
    setLoading(false)
    setError(null)
    setOpenNowOnly(false)
    setHasWebsiteOnly(false)
    setShareMessage(null)
    setHealthyStatus(null)
    poolRef.current = []
    healthyPoolRef.current = []
    prefetchPromiseRef.current = null
    // The saved-link auto-search is for page load only. Re-arming it here re-ran the old
    // search (its params are still in the URL for one render) and left a blank results page.
    autoRanRef.current = true
    setCityPickedByUser(false)
    updateParams((next) => {
      for (const key of Array.from(next.keys())) next.delete(key)
    })
  }, [updateParams])

  useEffect(() => {
    setSearchNav({
      onNewCity: startNewCitySearch,
      showNewCity: step !== 'city',
    })
    return () => setSearchNav(null)
  }, [step, startNewCitySearch, setSearchNav])

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
  const firstHunt4FoodScreen = step === 'city' || (step === 'cuisine' && !cityPickedByUser)
  useLeaveToLodgeOnBrowserBack(firstHunt4FoodScreen)

  function backFromCuisine() {
    if (cityPickedByUser) {
      setStep('city')
      return
    }
    leaveToLodge()
  }

  return (
    <>
      <AskBar onAsk={(text) => void askSearch(text)} busy={asking} message={askMessage} />
      {step === 'city' && (
        resolvingLocation ? (
          <section className="step">
            <p className="muted">Finding your location…</p>
            <div className="step-actions row">
              <a href={LODGE_HOME} className="btn ghost" onClick={leaveToLodge}>
                Back
              </a>
            </div>
          </section>
        ) : (
          <Suspense fallback={<p className="muted">Loading map…</p>}>
            <CityStep
              onConfirm={(selection) => confirmCity(selection, true)}
              onAsk={(text) => void askSearch(text)}
              onBack={leaveToLodge}
              initial={city}
            />
          </Suspense>
        )
      )}
      {step === 'cuisine' && city && (
        <CuisineStep
          cityLabel={city.label}
          selected={cuisines}
          keyword={keyword}
          healthyFocus={healthyFocus}
          onHealthyFocusChange={setHealthyFocus}
          dietary={dietary}
          onDietaryChange={changeDietary}
          onChange={setCuisines}
          onKeywordChange={setKeyword}
          onBack={backFromCuisine}
          onNext={startFind}
        />
      )}
      {step === 'results' && city && (
        <ResultsStep
          places={shownPlaces}
          seedOilRequired={requireNoSeedOils}
          seedOilHiddenCount={hiddenCounts.seedOil}
          lunchFilter={lunchFilter}
          lunchHiddenCount={hiddenCounts.lunch}
          onToggleLunchSpecial={() => {
            const next: LunchFilter = lunchFilter === 'special' ? null : 'special'
            setLunchFilter(next)
            lunchFilterRef.current = next
            writeSearchParams(cuisines, dietary, keyword, healthyFocus, next)
          }}
          cityLabel={city.label}
          cityCenter={city.center}
          cuisineLabels={cuisineLabels}
          keyword={keyword.trim() || undefined}
          loading={loading}
          error={error}
          healthyMode={healthyMode}
          searchStatus={healthyStatus}
          showSeedOil={dietary.includes('no_seed_oils') || healthyMode}
          openNowOnly={openNowOnly}
          hasWebsiteOnly={hasWebsiteOnly}
          healthyFocus={healthyFocus}
          onHealthyFocusChange={changeHealthyFocus}
          healthyPrefs={healthyPrefs}
          onHealthyPrefsChange={(prefs) => changeHealthyFocus(healthyFocus, prefs)}
          maxMiles={maxMiles}
          onMaxMilesChange={setMaxMiles}
          priceLevels={priceLevels}
          onPriceLevelsChange={setPriceLevels}
          ratingsMap={ratingsMap}
          ratingsLoading={ratingsLoading}
          seedOilMap={seedOilMap}
          seedOilLoading={seedOilLoading}
          dishesMap={dishesMap}
          dishesLoading={dishesLoading}
          favoriteIds={favoriteIds}
          onToggleFavorite={(place) => {
            setFavoriteIds((prev) => {
              const next = new Set(prev)
              if (next.has(place.id)) next.delete(place.id)
              else next.add(place.id)
              return next
            })
          }}
          onSearchAgain={() => void searchAgain()}
          onToggleOpenNow={() => setOpenNowOnly((v) => !v)}
          onToggleWebsite={() => setHasWebsiteOnly((v) => !v)}
          lovedIds={lovedIds}
          shortlistedIds={shortlistedIds}
          shareMessage={shareMessage}
          onCopySearchLink={() => void copySearchLink()}
          onRetry={() => void runSearch(city, cuisines, dietary, keyword)}
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
            setDisplayPlaces((prev) => prev.filter((p) => p.id !== place.id))
            setFavoriteIds((prev) => {
              if (!prev.has(place.id)) return prev
              const next = new Set(prev)
              next.delete(place.id)
              return next
            })
            setSeenIds((prev) => new Set(prev).add(place.id))
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
          onNewSearch={startNewCitySearch}
          scrollToResultsKey={scrollToResultsKey}
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

/** Shared links are untrusted input: keep only well-formed items so rendering cannot crash. */
function parseSharedShortlist(raw: string): ShortlistItem[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Older links were double-encoded.
    parsed = JSON.parse(decodeURIComponent(raw))
  }
  if (!Array.isArray(parsed)) return []
  const seen = new Set<string>()
  return parsed.flatMap((item): ShortlistItem[] => {
    if (!item || typeof item !== 'object') return []
    const { id, name, city } = item as Record<string, unknown>
    if (typeof id !== 'string' || typeof name !== 'string' || seen.has(id)) return []
    seen.add(id)
    return [{ ...(item as ShortlistItem), id, name, city: typeof city === 'string' ? city : undefined }]
  })
}

function ShortlistView() {
  const [params] = useSearchParams()
  const items = useMemo(() => {
    try {
      const raw = params.get('data')
      if (!raw) return []
      return parseSharedShortlist(raw)
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
      <Link className="btn primary" to="/">
        Start your own search
      </Link>
    </section>
  )
}

function SearchRoute() {
  const location = useLocation()
  const reset = (location.state as { reset?: number } | null)?.reset ?? 0
  return <SearchFlow key={reset} />
}

function Shell() {
  const navigate = useNavigate()
  const [searchNav, setSearchNav] = useState<SearchNavState | null>(null)

  useEffect(() => {
    ensureCacheGeneration()
    // Pruning parses every cached entry; keep it off the startup path.
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    if (idle) {
      idle(() => pruneExpiredCache())
      return
    }
    const timer = window.setTimeout(pruneExpiredCache, 2000)
    return () => window.clearTimeout(timer)
  }, [])

  function goHome() {
    navigate('/', { replace: true, state: { reset: Date.now() } })
  }

  return (
    <SearchNavContext.Provider value={{ searchNav, setSearchNav }}>
    <div className="app-shell">
      <div className="atmosphere" aria-hidden />
      <header className="topbar">
        <div className="topbar-brands">
          <a
            href={LODGE_HOME}
            className="base-camp-home"
            aria-label="Base Camp home"
            onClick={leaveToLodge}
          >
            <img
              src="/logos/7D1A58C5-AFB4-4707-9696-BC085F5048A5.png"
              alt=""
              draggable={false}
              decoding="async"
            />
          </a>
          <button type="button" className="top-brand" onClick={goHome} aria-label={brandAriaLabel()}>
            <BrandMark />
          </button>
        </div>
        <nav>
          {searchNav?.showNewCity && (
            <button type="button" className="topbar-link" onClick={searchNav.onNewCity}>
              New city
            </button>
          )}
          <Link to="/taste">My Taste</Link>
          <Link to="/settings">Settings</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<SearchRoute />} />
          <Route path="/search" element={<Navigate to="/" replace />} />
          <Route path="/taste" element={<TasteRoute />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/shortlist" element={<ShortlistView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <p>
          <BrandMark size="sm" /> · Place data ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap contributors
          </a>
          . Ratings from Google, Yelp, and TripAdvisor when available. Seed-oil chain grades from{' '}
          <a href="https://seedoiltracker.com" target="_blank" rel="noreferrer">
            Seed Oil Tracker
          </a>
          . Taste profiles stay on your device.
        </p>
      </footer>
    </div>
    </SearchNavContext.Provider>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
