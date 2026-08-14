import { useEffect, useState } from 'react'
import { fetchPlaceRatings, type PlaceRatings } from '../lib/ratings'
import type { RankedRestaurant } from '../lib/types'

export function usePlaceRatings(places: RankedRestaurant[], cityLabel: string, enabled: boolean) {
  const [map, setMap] = useState<Record<string, PlaceRatings>>({})
  const [loading, setLoading] = useState(false)
  const placeIds = places.map((p) => p.id).join(',')

  useEffect(() => {
    if (!enabled || places.length === 0) return
    const ctrl = new AbortController()
    setLoading(true)
    setMap({})

    void (async () => {
      for (const place of places) {
        if (ctrl.signal.aborted) break
        try {
          const ratings = await fetchPlaceRatings(place, cityLabel, ctrl.signal)
          setMap((prev) => ({ ...prev, [place.id]: ratings }))
        } catch {
          // skip
        }
        await new Promise((r) => setTimeout(r, 350))
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
