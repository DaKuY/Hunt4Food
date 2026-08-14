import { useEffect, useState } from 'react'
import { fetchSeedOilInfo, readCachedSeedOil, type SeedOilInfo } from '../lib/seedOil'
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
  const placeIds = places.map((p) => p.id).join(',')

  useEffect(() => {
    if (!enabled || places.length === 0) return
    const ctrl = new AbortController()
    setMap(seedFromCache(places))
    setLoading(true)

    void (async () => {
      for (const place of places) {
        if (ctrl.signal.aborted) break
        try {
          const info = await fetchSeedOilInfo(place, ctrl.signal)
          setMap((prev) => ({ ...prev, [place.id]: info }))
        } catch {
          // skip
        }
        if (!readCachedSeedOil(place)) {
          await new Promise((r) => setTimeout(r, 200))
        }
      }
      if (!ctrl.signal.aborted) setLoading(false)
    })()

    return () => {
      ctrl.abort()
      setLoading(false)
    }
  }, [placeIds, enabled, places])

  return { seedOilMap: map, seedOilLoading: loading }
}
