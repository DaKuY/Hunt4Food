import { useState } from 'react'
import { googleMapsUsable } from '../lib/googleMapsLoader'
import type { RankedRestaurant } from '../lib/types'
import { GoogleEmbedMap } from './GoogleEmbedMap'
import { GoogleResultsMap } from './GoogleMaps'

type Props = {
  places: RankedRestaurant[]
  center: { lat: number; lon: number }
}

/**
 * Google Maps with numbered pins when a Maps JavaScript key is configured; otherwise the
 * keyless Google embed centred on the #1 pick (every card also opens in Google Maps).
 */
export function ResultsMap({ places, center }: Props) {
  const [google, setGoogle] = useState(() => googleMapsUsable())
  if (!places.length) return null
  if (google) return <GoogleResultsMap places={places} center={center} onFail={() => setGoogle(false)} />
  const top = places[0]!
  return (
    <GoogleEmbedMap
      className="map-shell results-map-shell"
      center={{ lat: top.lat, lon: top.lon }}
      zoom={14}
      query={[top.name, top.address].filter(Boolean).join(', ')}
      title={`Map: ${top.name}`}
    />
  )
}
