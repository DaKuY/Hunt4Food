import { useEffect, useRef, useState } from 'react'
import { fetchSeedOilInfo, readCachedSeedOil, type SeedOilInfo } from '../lib/seedOil'
import { mapPool } from '../lib/pool'
import type { RankedRestaurant } from '../lib/types'

function seedFromCache(places: RankedRestaurant[]): Record<string, SeedOilInfo> {
  const initial: Record<string, SeedOilInfo> = {}
  for (const place of places) {
    const hit = readCachedSeedOil(place)
    if (hit) initial[place.id] = hit
  }
  return initial
}

export function usePlaceSeedOil(places: RankedRestaurant[], enabled: boolean) {
  const [map, setMap] = useState<Record<string, SeedOilInfo>>(() =>
    enabled ? seedFromCache(places) : {},
  )
  const [loading, setLoading] = useState(false)
  const placesRef = useRef(places)
  placesRef.current = places
  const placeIds = places.map((p) => p.id).join(',')

  useEffect(() => {
    if (!enabled || !placeIds) {
      setMap({})
      setLoading(false)
      return
    }
    const list = placesRef.current
    const ctrl = new AbortController()
    setMap(seedFromCache(list))
    setLoading(true)

    void mapPool(
      list,
      6,
      async (place) => {
        if (ctrl.signal.aborted) return
        try {
          const info = await fetchSeedOilInfo(place, ctrl.signal)
          if (!ctrl.signal.aborted) {
            setMap((prev) => ({ ...prev, [place.id]: info }))
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
  }, [placeIds, enabled])

  return { seedOilMap: map, seedOilLoading: loading }
}
