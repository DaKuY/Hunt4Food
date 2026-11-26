import { lazy, Suspense, useState } from 'react'
import { googleMapsUsable } from '../lib/googleMapsLoader'
import type { RankedRestaurant } from '../lib/types'
import { GoogleResultsMap } from './GoogleMaps'

const LeafletResultsMap = lazy(() => import('./LeafletResultsMap'))

type Props = {
  places: RankedRestaurant[]
  center: { lat: number; lon: number }
}

/** Google Maps when a key is configured; OpenStreetMap otherwise or if Google fails. */
export function ResultsMap({ places, center }: Props) {
  const [google, setGoogle] = useState(() => googleMapsUsable())
  if (!places.length) return null
  if (google) return <GoogleResultsMap places={places} center={center} onFail={() => setGoogle(false)} />
  return (
    <Suspense fallback={<div className="map-shell results-map-shell" />}>
      <LeafletResultsMap places={places} center={center} />
    </Suspense>
  )
}
