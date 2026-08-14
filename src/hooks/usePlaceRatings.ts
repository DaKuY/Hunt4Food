import { useEffect, useState } from 'react'
import { fetchPlaceRatings, readCachedPlaceRatings, type PlaceRatings } from '../lib/ratings'
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
  const placeIds = places.map((p) => p.id).join(',')

  useEffect(() => {
    if (!enabled || places.length === 0) return
    const ctrl = new AbortController()
    setMap(seedFromCache(places, cityLabel))
    setLoading(true)

    void (async () => {
      for (const place of places) {
        if (ctrl.signal.aborted) break
        try {
          const ratings = await fetchPlaceRatings(place, cityLabel, ctrl.signal)
          setMap((prev) => ({ ...prev, [place.id]: ratings }))
        } catch {
          // skip
        }
        const cached = readCachedPlaceRatings(place, cityLabel)
        if (!cached) {
          await new Promise((r) => setTimeout(r, 350))
        }
      }
      if (!ctrl.signal.aborted) setLoading(false)
    })()

    return () => {
      ctrl.abort()
      setLoading(false)
    }
  }, [placeIds, cityLabel, enabled, places])

  return { ratingsMap: map, ratingsLoading: loading }
}
