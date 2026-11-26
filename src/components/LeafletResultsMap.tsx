import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import type { RankedRestaurant } from '../lib/types'
import 'leaflet/dist/leaflet.css'

type Props = {
  places: RankedRestaurant[]
  center: { lat: number; lon: number }
}

/** OpenStreetMap fallback when Google Maps has no key or fails to load. */
export default function LeafletResultsMap({ places, center }: Props) {
  return (
    <div className="map-shell results-map-shell">
      <MapContainer center={[center.lat, center.lon]} zoom={13} className="city-map results-map" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {places.map((p, i) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lon]}
            radius={10}
            pathOptions={
              p.nextBest
                ? { color: '#85632a', fillColor: '#c4a265', fillOpacity: 0.85, weight: 2 }
                : { color: '#06301b', fillColor: '#0a4a2a', fillOpacity: 0.85, weight: 2 }
            }
          >
            <Popup>
              <strong>
                {i + 1}. {p.name}
              </strong>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
