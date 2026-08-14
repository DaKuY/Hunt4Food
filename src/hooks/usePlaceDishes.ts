import { useEffect, useMemo, useRef, useState } from 'react'
import { signatureDishes } from '../lib/dishes'
import type { CuisineId, RankedRestaurant } from '../lib/types'

export function usePlaceDishes(
  places: RankedRestaurant[],
  cityLabel: string,
  selectedCuisines: CuisineId[],
  enabled: boolean,
) {
  const cuisineKey = selectedCuisines.join(',')
  const instant = useMemo(() => {
    if (!enabled) return {}
    const next: Record<string, string[]> = {}
    for (const place of places) {
      next[place.id] = signatureDishes(place, selectedCuisines)
    }
    return next
  }, [enabled, places, selectedCuisines])

  const [map, setMap] = useState<Record<string, string[]>>(instant)
  const placesRef = useRef(places)
  placesRef.current = places
  const placeIds = places.map((p) => p.id).join(',')

  useEffect(() => {
    if (!enabled || !placeIds) {
      setMap({})
      return
    }
    const next: Record<string, string[]> = {}
    for (const place of placesRef.current) {
      next[place.id] = signatureDishes(place, selectedCuisines)
    }
    setMap(next)
  }, [placeIds, cityLabel, enabled, cuisineKey, selectedCuisines])

  return { dishesMap: map, dishesLoading: false }
}
