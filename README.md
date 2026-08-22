# Hunt4Food — Restaurant Finder

Hunt what’s good to eat nearby. Pick a place on the map, choose up to three cuisines, get ten ranked recommendations that taste great (including healthier picks), and open Google / Yelp / TripAdvisor for live reviews.

**Live app (after Pages is enabled):** https://dakuy.github.io/restaurant-finder/

## What it does

1. **City** — type a name or zoom the map to a neighborhood
2. **Food** — pick up to 3 cuisines (+ optional dietary boosts)
3. **Results** — top 10 from OpenStreetMap, with “why recommended,” **Google / Yelp / TripAdvisor ratings**, website/menu links
4. **My Taste** — mark Loved it / Not for me; profile stays in your browser (export/import JSON to move devices)
5. **Settings** — Google Places API key override; Yelp/TripAdvisor proxy URL (required for those ratings)

No accounts required for basic use. Data from OpenStreetMap via Photon + Overpass.

### Google ratings setup (one-time)

1. **Enable Places API (New)** on your Google Cloud project
2. Restrict the key to HTTP referrer `https://dakuy.github.io/*`
3. Add repo secret **`VITE_GOOGLE_PLACES_API_KEY`** (Settings → Secrets → Actions) — never commit the key to git
4. The app caps Google rating lookups at **40/day** and **400/month** automatically

### Ratings note

- **Google**: Places Text Search via build-time secret or Settings override; hard daily/monthly caps; **cached until midnight UTC** (no repeat API calls same day)
- **Yelp & TripAdvisor**: require a free [Google Apps Script proxy](scripts/ratings-proxy/README.md). Ratings are **cached per day** in your browser.

### Yelp / TripAdvisor setup (one-time)

1. Deploy `scripts/ratings-proxy/Code.gs` at [script.google.com](https://script.google.com) (see [README](scripts/ratings-proxy/README.md))
2. Add GitHub environment secret **`VITE_RATINGS_PROXY_URL`** = your `/exec` URL, **or** paste the URL in the app’s **Settings** page
3. Optional: add **`YELP_API_KEY`** in Apps Script properties for Yelp Fusion (recommended)
4. After updating `Code.gs`, redeploy the web app (**Deploy → Manage deployments → Edit → New version**) so TripAdvisor fixes take effect

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
- Review **scores** from Yelp/TripAdvisor need the Apps Script proxy; Google uses Places API
- Taste profiles are per-browser unless you export/import JSON
- Be polite to public Overpass/Photon services — the app caches and throttles

## Attribution

Place data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
