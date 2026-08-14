# OpenPlate — Restaurant Finder

Find good restaurants in any city. Pick a place on the map, choose up to three cuisines, get ten ranked recommendations, and open Google / Yelp / TripAdvisor for live reviews.

**Live app (after Pages is enabled):** https://dakuy.github.io/restaurant-finder/

## What it does

1. **City** — type a name or zoom the map to a neighborhood
2. **Food** — pick up to 3 cuisines (+ optional dietary boosts)
3. **Results** — top 10 from OpenStreetMap, with “why recommended,” website/menu links, and review deep links
4. **My Taste** — mark Loved it / Not for me; profile stays in your browser (export/import JSON to move devices)

No API keys. No extra accounts. Data from OpenStreetMap via Photon + Overpass.

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
