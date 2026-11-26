import { useEffect, useRef } from 'react'
import { directionsUrl, googleMapId, loadGoogleMaps, onGoogleMapsAuthFailure } from '../lib/googleMapsLoader'
import type { MapBounds, RankedRestaurant } from '../lib/types'

const FOREST = '#0A4A2A'
const FOREST_DEEP = '#06301B'
const BRASS = '#85632A'
const IVORY = '#FBF3EC'

/** Built with DOM nodes, never HTML strings: place names come from third-party listings. */
function infoContent(place: RankedRestaurant, rank: number): HTMLElement {
  const box = document.createElement('div')
  box.className = 'gmap-info'
  const title = document.createElement('strong')
  title.textContent = `${rank}. ${place.name}`
  box.append(title)
  if (place.nextBest) {
    const tag = document.createElement('span')
    tag.className = 'gmap-info-tag'
    tag.textContent = 'Next best'
    box.append(tag)
  }
  const link = document.createElement('a')
  link.href = directionsUrl(place)
  link.target = '_blank'
  link.rel = 'noreferrer'
  link.textContent = 'Directions'
  box.append(link)
  return box
}

type ResultsProps = {
  places: RankedRestaurant[]
  center: { lat: number; lon: number }
  onFail: () => void
}

/** Numbered pins in result order; next-best picks in brass. Tap a pin for directions. */
export function GoogleResultsMap({ places, center, onFail }: ResultsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onFailRef = useRef(onFail)
  onFailRef.current = onFail
  const placesKey = places.map((p) => `${p.id}:${p.nextBest ? 1 : 0}`).join(',')

  useEffect(() => onGoogleMapsAuthFailure(() => onFailRef.current()), [])

  useEffect(() => {
    let cancelled = false
    const markers: google.maps.marker.AdvancedMarkerElement[] = []
    loadGoogleMaps()
      .then(({ maps, marker }) => {
        if (cancelled || !ref.current) return
        const map = new maps.Map(ref.current, {
          center: { lat: center.lat, lng: center.lon },
          zoom: 13,
          mapId: googleMapId(),
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          // One finger scrolls the page on iPhone; two fingers move the map.
          gestureHandling: 'cooperative',
        })
        const info = new maps.InfoWindow()
        const bounds = new google.maps.LatLngBounds()
        places.forEach((place, index) => {
          const position = { lat: place.lat, lng: place.lon }
          const pin = new marker.PinElement({
            glyph: String(index + 1),
            glyphColor: IVORY,
            background: place.nextBest ? BRASS : FOREST,
            borderColor: FOREST_DEEP,
          })
          const pinMarker = new marker.AdvancedMarkerElement({
            map,
            position,
            content: pin.element,
            title: `${index + 1}. ${place.name}`,
          })
          pinMarker.addListener('click', () => {
            info.setContent(infoContent(place, index + 1))
            info.open({ map, anchor: pinMarker })
          })
          markers.push(pinMarker)
          bounds.extend(position)
        })
        if (places.length > 1) map.fitBounds(bounds, 40)
      })
      .catch(() => {
        if (!cancelled) onFailRef.current()
      })
    return () => {
      cancelled = true
      for (const pinMarker of markers) pinMarker.map = null
    }
    // placesKey stands in for places: same ids and labels, same pins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey, center.lat, center.lon])

  return (
    <div className="map-shell results-map-shell">
      <div ref={ref} className="city-map results-map google-map" role="region" aria-label="Map of the results" />
    </div>
  )
}

type AreaProps = {
  center: [number, number]
  zoom: number
  rect: MapBounds | null
  onBounds: (bounds: MapBounds, center: { lat: number; lon: number }) => void
  onFail: () => void
}

/** The area picker: pan and zoom, and the visible area becomes the search box. */
export function GoogleAreaMap({ center, zoom, rect, onBounds, onFail }: AreaProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const rectRef = useRef<google.maps.Rectangle | null>(null)
  const onBoundsRef = useRef(onBounds)
  onBoundsRef.current = onBounds
  const onFailRef = useRef(onFail)
  onFailRef.current = onFail

  const [lat, lon] = center
  useEffect(() => onGoogleMapsAuthFailure(() => onFailRef.current()), [])

  useEffect(() => {
    let cancelled = false
    let listener: google.maps.MapsEventListener | null = null
    loadGoogleMaps()
      .then(({ maps }) => {
        if (cancelled || !ref.current) return
        const map = new maps.Map(ref.current, {
          center: { lat, lng: lon },
          zoom,
          mapId: googleMapId(),
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
        })
        mapRef.current = map
        // Like the old map: report the area after the person moves it, not on first paint.
        let first = true
        listener = map.addListener('idle', () => {
          if (first) {
            first = false
            return
          }
          const b = map.getBounds()
          const c = map.getCenter()
          if (!b || !c) return
          const ne = b.getNorthEast()
          const sw = b.getSouthWest()
          onBoundsRef.current(
            { south: sw.lat(), west: sw.lng(), north: ne.lat(), east: ne.lng() },
            { lat: c.lat(), lon: c.lng() },
          )
        })
      })
      .catch(() => {
        if (!cancelled) onFailRef.current()
      })
    return () => {
      cancelled = true
      listener?.remove()
      rectRef.current?.setMap(null)
      rectRef.current = null
      mapRef.current = null
    }
    // A new center or zoom (search, location, recent city) rebuilds the map, like the old one.
  }, [lat, lon, zoom])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!rect) {
      rectRef.current?.setMap(null)
      return
    }
    const bounds = { south: rect.south, west: rect.west, north: rect.north, east: rect.east }
    if (!rectRef.current) {
      rectRef.current = new google.maps.Rectangle({
        map,
        bounds,
        strokeColor: BRASS,
        strokeWeight: 2,
        fillColor: BRASS,
        fillOpacity: 0.08,
        clickable: false,
      })
    } else {
      rectRef.current.setBounds(bounds)
      rectRef.current.setMap(map)
    }
  })

  return <div ref={ref} className="city-map google-map" role="region" aria-label="Map: move it to choose an area" />
}
