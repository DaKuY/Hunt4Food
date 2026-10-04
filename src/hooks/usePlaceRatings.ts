import { useEffect, useRef, useState } from 'react'
import {
  emptyPlaceRatings,
  fetchGoogleRating,
  fetchTripadvisorRating,
  fetchYelpRating,
  readCachedPlaceRatings,
  withPlacePrice,
  type PlaceRatings,
} from '../lib/ratings'
import { mapPool } from '../lib/pool'
import type { RankedRestaurant } from '../lib/types'

function seedFromCache(places: RankedRestaurant[], cityLabel: string): Record<string, PlaceRatings> {
  const initial: Record<string, PlaceRatings> = {}
  for (const place of places) {
    const hit = readCachedPlaceRatings(place, cityLabel)
    if (hit) initial[place.id] = hit
  }
  return initial
}

export function usePlaceRatings(
  places: RankedRestaurant[],
  cityLabel: string,
  enabled: boolean,
  opts?: { skipGoogle?: boolean },
) {
  const [map, setMap] = useState<Record<string, PlaceRatings>>(() =>
    enabled ? seedFromCache(places, cityLabel) : {},
  )
  const [loading, setLoading] = useState(false)
  const placesRef = useRef(places)
  placesRef.current = places
  const placeIds = places.map((p) => p.id).sort().join(',')

  useEffect(() => {
    if (!enabled || !placeIds) return
    const list = placesRef.current
    const ctrl = new AbortController()
    setMap(seedFromCache(list, cityLabel))
    setLoading(true)

    // Rating responses arrive one by one; each state update re-renders and
    // re-sorts the result list, so apply them in small batches.
    let pending: Array<[string, (base: PlaceRatings) => PlaceRatings]> = []
    let flushTimer = 0
    const flush = () => {
      flushTimer = 0
      if (ctrl.signal.aborted || !pending.length) return
      const batch = pending
      pending = []
      setMap((prev) => {
        const next = { ...prev }
        const byId = new Map(list.map((place) => [place.id, place]))
        for (const [id, apply] of batch) {
          const place = byId.get(id)
          if (!place) continue
          next[id] = withPlacePrice(apply(next[id] ?? emptyPlaceRatings(place, cityLabel)))
        }
        return next
      })
    }
    const queue = (id: string, apply: (base: PlaceRatings) => PlaceRatings) => {
      pending.push([id, apply])
      if (!flushTimer) flushTimer = window.setTimeout(flush, 120)
    }

    const runSource = <K extends 'google' | 'yelp' | 'tripadvisor'>(
      key: K,
      concurrency: number,
      fetchRating: (place: RankedRestaurant, city: string, signal: AbortSignal) => Promise<PlaceRatings[K]>,
    ) =>
      mapPool(
        list,
        concurrency,
        async (place) => {
          if (ctrl.signal.aborted) return
          try {
            const rating = await fetchRating(place, cityLabel, ctrl.signal)
            if (!ctrl.signal.aborted) queue(place.id, (base) => ({ ...base, [key]: rating }))
          } catch {
            // skip
          }
        },
        ctrl.signal,
      )

    // The three sources are independent proxy calls; fetch them side by side
    // instead of waiting for every Google lookup before starting Yelp, etc.
    void Promise.all([
      opts?.skipGoogle ? Promise.resolve() : runSource('google', 8, fetchGoogleRating),
      runSource('yelp', 4, fetchYelpRating),
      runSource('tripadvisor', 3, fetchTripadvisorRating),
    ]).then(() => {
      if (ctrl.signal.aborted) return
      window.clearTimeout(flushTimer)
      flush()
      setLoading(false)
    })

    return () => {
      ctrl.abort()
      window.clearTimeout(flushTimer)
      setLoading(false)
    }
  }, [placeIds, cityLabel, enabled, opts?.skipGoogle])

  return { ratingsMap: map, ratingsLoading: loading }
}
