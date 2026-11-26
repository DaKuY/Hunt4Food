import { MapContainer, TileLayer, useMapEvents, Rectangle } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import type { MapBounds } from '../lib/types'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons under Vite
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

type Props = {
  center: [number, number]
  zoom: number
  rect: MapBounds | null
  onBounds: (bounds: MapBounds, center: { lat: number; lon: number }) => void
}

function BoundsWatcher({ onBounds }: Pick<Props, 'onBounds'>) {
  const map = useMapEvents({
    moveend: () => report(),
    zoomend: () => report(),
  })
  function report() {
    const b = map.getBounds()
    const c = map.getCenter()
    onBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, { lat: c.lat, lon: c.lng })
  }
  return null
}

/** OpenStreetMap area picker: the fallback when Google Maps is unavailable. */
export default function LeafletAreaMap({ center, zoom, rect, onBounds }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} className="city-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <BoundsWatcher onBounds={onBounds} />
      {rect && (
        <Rectangle
          bounds={[
            [rect.south, rect.west],
            [rect.north, rect.east],
          ]}
          pathOptions={{ color: '#85632a', weight: 2, fillOpacity: 0.08 }}
        />
      )}
    </MapContainer>
  )
}
