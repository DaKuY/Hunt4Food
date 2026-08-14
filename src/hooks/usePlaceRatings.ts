import { useEffect, useRef, useState } from 'react'
import { fetchPlaceRatings, readCachedPlaceRatings, type PlaceRatings } from '../lib/ratings'
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

    void mapPool(
      list,
      5,
      async (place) => {
        if (ctrl.signal.aborted) return
        try {
          const ratings = await fetchPlaceRatings(place, cityLabel, ctrl.signal)
          if (!ctrl.signal.aborted) {
            setMap((prev) => ({ ...prev, [place.id]: ratings }))
          }
        } catch {
          // skip
        }
      },
      ctrl.signal,
    ).then(() => {
      if (!ctrl.signal.aborted) setLoading(false)
    })

    return () => {
      ctrl.abort()
      setLoading(false)
    }
  }, [placeIds, cityLabel, enabled])

  return { ratingsMap: map, ratingsLoading: loading }
}
