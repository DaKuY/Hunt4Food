# OpenPlate — Restaurant Finder

Find good restaurants in any city. Pick a place on the map, choose up to three cuisines, get ten ranked recommendations, and open Google / Yelp / TripAdvisor for live reviews.

**Live app (after Pages is enabled):** https://dakuy.github.io/restaurant-finder/

## What it does

1. **City** — type a name or zoom the map to a neighborhood
2. **Food** — pick up to 3 cuisines (+ optional dietary boosts)
3. **Results** — top 10 from OpenStreetMap, with “why recommended,” **Google / Yelp / TripAdvisor ratings**, website/menu links
4. **My Taste** — mark Loved it / Not for me; profile stays in your browser (export/import JSON to move devices)
5. **Settings** — optional Google Places API key for reliable Google star ratings (Yelp/TripAdvisor load automatically when possible)

No accounts required for basic use. Data from OpenStreetMap via Photon + Overpass.

### Ratings note

- **Google**: add a free [Places API key](https://console.cloud.google.com/google/maps-apis/) in **Settings** (or `VITE_GOOGLE_PLACES_API_KEY` at build time)
- **Yelp & TripAdvisor**: fetched automatically via public lookups (best-effort; may show — when blocked)

## One-time GitHub Pages setup

If the site is not live yet:

1. Repo **Settings → Pages**
2. **Source:** GitHub Actions
3. Merge to `main` (or re-run the **Deploy GitHub Pages** workflow)

## Local development

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

Note: local preview uses base path `/restaurant-finder/`.

## Limits (honest)

- OpenStreetMap coverage varies by city; thin areas show a Google/Yelp fallback
- Review **scores** are not embedded (that needs paid APIs). Buttons open Google, Yelp, and TripAdvisor
- Taste profiles are per-browser unless you export/import JSON
- Be polite to public Overpass/Photon services — the app caches and throttles

## Attribution

Place data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
