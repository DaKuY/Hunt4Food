import { useEffect, useState } from 'react'
import { fetchPopularDishes } from '../lib/dishes'
import type { CuisineId, RankedRestaurant } from '../lib/types'

export function usePlaceDishes(
  places: RankedRestaurant[],
  cityLabel: string,
  selectedCuisines: CuisineId[],
  enabled: boolean,
) {
  const [map, setMap] = useState<Record<string, string[]>>({})
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
          const dishes = await fetchPopularDishes(place, cityLabel, selectedCuisines, ctrl.signal)
          setMap((prev) => ({ ...prev, [place.id]: dishes }))
        } catch {
          // skip
        }
        await new Promise((r) => setTimeout(r, 200))
      }
      if (!ctrl.signal.aborted) setLoading(false)
    })()

    return () => {
      ctrl.abort()
      setLoading(false)
    }
  }, [placeIds, cityLabel, enabled, places, selectedCuisines])

  return { dishesMap: map, dishesLoading: loading }
}
