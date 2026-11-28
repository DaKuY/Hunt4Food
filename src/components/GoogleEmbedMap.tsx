import { googleEmbedUrl } from '../lib/googleMapsLoader'

type Props = {
  center: { lat: number; lon: number }
  zoom: number
  /** A place ("Flower Child, 123 Main St") or a search ("healthy food"); the center otherwise. */
  query?: string
  title: string
  className: string
}

/**
 * Google Maps without an API key (the standard maps.google.com embed). Used when the
 * Maps JavaScript key isn't configured or Google refuses it, so the app never falls
 * back to OpenStreetMap. It can't report pan/zoom, so the area picker relies on the
 * town search and "Use my location" in that case.
 */
export function GoogleEmbedMap({ center, zoom, query, title, className }: Props) {
  return (
    <iframe
      className={`${className} google-embed-map`}
      src={googleEmbedUrl(center, zoom, query)}
      title={title}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  )
}
