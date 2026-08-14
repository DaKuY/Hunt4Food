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

export function usePlaceRatings(places: RankedRestaurant[], cityLabel: string, enabled: boolean) {
  const [map, setMap] = useState<Record<string, PlaceRatings>>(() =>
    enabled ? seedFromCache(places, cityLabel) : {},
  )
  const [loading, setLoading] = useState(false)
  const placesRef = useRef(places)
  placesRef.current = places
  const placeIds = places.map((p) => p.id).join(',')

  useEffect(() => {
    if (!enabled || !placeIds) return
    const list = placesRef.current
    const ctrl = new AbortController()
    setMap(seedFromCache(list, cityLabel))
    setLoading(true)

    void (async () => {
      await mapPool(
        list,
        8,
        async (place) => {
          if (ctrl.signal.aborted) return
          try {
            const google = await fetchGoogleRating(place, cityLabel, ctrl.signal)
            if (ctrl.signal.aborted) return
            setMap((prev) => {
              const base = prev[place.id] ?? emptyPlaceRatings(place, cityLabel)
              return { ...prev, [place.id]: withPlacePrice({ ...base, google }) }
            })
          } catch {
            // skip
          }
        },
        ctrl.signal,
      )

      if (ctrl.signal.aborted) return

      await mapPool(
        list,
        4,
        async (place) => {
          if (ctrl.signal.aborted) return
          try {
            const yelp = await fetchYelpRating(place, cityLabel, ctrl.signal)
            if (ctrl.signal.aborted) return
            setMap((prev) => {
              const base = prev[place.id] ?? emptyPlaceRatings(place, cityLabel)
              return { ...prev, [place.id]: withPlacePrice({ ...base, yelp }) }
            })
          } catch {
            // skip
          }
        },
        ctrl.signal,
      )

      if (ctrl.signal.aborted) return

      await mapPool(
        list,
        3,
        async (place) => {
          if (ctrl.signal.aborted) return
          try {
            const tripadvisor = await fetchTripadvisorRating(place, cityLabel, ctrl.signal)
            if (ctrl.signal.aborted) return
            setMap((prev) => {
              const base = prev[place.id] ?? emptyPlaceRatings(place, cityLabel)
              return { ...prev, [place.id]: withPlacePrice({ ...base, tripadvisor }) }
            })
          } catch {
            // skip
          }
        },
        ctrl.signal,
      )

      if (!ctrl.signal.aborted) setLoading(false)
    })()

    return () => {
      ctrl.abort()
      setLoading(false)
    }
  }, [placeIds, cityLabel, enabled])

  return { ratingsMap: map, ratingsLoading: loading }
}
