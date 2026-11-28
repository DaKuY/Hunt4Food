# Hunt4Food — Restaurant Finder

Hunt what’s good to eat nearby. Pick a place on the map, choose up to three cuisines, get ten ranked recommendations that taste great (including healthier picks), and open Google / Yelp / TripAdvisor for live reviews.

**Live app:** https://hunt4food.andrewcamero.com (lodge-gated; sign in at https://andrewcamero.com)

## Search (iPhone first)

The big search box is the main way in. Type what you want in plain words, or tap a quick pick:

- **"True Food Kitchen"**, **"smoothie bowl"**, **"salmon"**, **"grass fed burger no seed oils"** → the healthy hunt, with that focus
- **"healthy food Coppell"** or just **"Coppell"** → a town typed without "in"/"near" is recognized (it must match a real town name, so "birria" stays a food)
- **"Mexican near Coppell TX without seed oils"** → a regular cuisine search with the seed-oil filter
- No food named → healthy picks where you are

**Healthy first, then the next best.** Clean-food evidence (grass-fed, no seed oils, avocado oil, organic, wild-caught), known healthy brands (True Food Kitchen, Flower Child, Tropical Smoothie, Pure Green…), salmon, steak, smoothie and plant-forward spots lead. When fewer than ten turn up, the list is filled with clearly labeled **Next best** picks: healthy spots outside your exact choice, then whole-food-friendly kitchens (Mediterranean, poke, sushi, Vietnamese, Peruvian…). Pizza, burgers, wings, fried chicken, fast food, bars and dessert never appear. Healthy searches look at least ~5 miles around the town center.

**Sources.** Google Places is the main source (`/api/discover`, server key `GOOGLE_PLACES_API_KEY`), with Yelp alongside. Each Google query asks for 20 results (billed per request, not per result) plus Google's editorial summary and "serves vegetarian" flag, which feed the healthy-evidence reader. A healthy hunt makes two discovery calls: your own words (or "healthy restaurant", grass-fed steak, wild salmon) and the clean brands. A cuisine search also asks for the healthy version ("healthy mexican"), and every ranking leans healthy: clean-food evidence and plant-forward kitchens rise, dessert-only spots sink. OpenStreetMap is used **only** when Google isn't connected or finds fewer than five places; the results line says which sources answered.

**Maps.** Always Google. With `VITE_GOOGLE_MAPS_API_KEY` (or a browser Places key with Maps JavaScript API enabled): the interactive map with numbered pins, brass pins for next-best picks, tap a pin for directions. Free up to 10,000 map loads a month ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)). Without a key, or if Google refuses it, a keyless Google Maps embed shows the area (picker) or the #1 pick (results).

### Google Maps setup (one-time)

1. Google Cloud Console → the project with your Places key → **APIs & Services → Library → Maps JavaScript API → Enable**
2. **Credentials → Create credentials → API key**. Restrict it: *Application restrictions* → Websites → `https://hunt4food.andrewcamero.com/*`; *API restrictions* → Maps JavaScript API
3. **Map Management → Create map ID** (JavaScript, Vector). Copy the ID
4. Vercel → Hunt4Food → Settings → Environment Variables: `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_MAP_ID` (Production + Preview), then redeploy
5. Optional: Billing → Budgets & alerts → a $1 budget alert, so you hear about it long before any charge

Google Places discovery with ratings and editorial summaries is the Text Search Enterprise + Atmosphere SKU: 1,000 free requests a month. Results are cached per city per day in the browser, so personal use stays within it.

## What it does

1. **City** — type a name or zoom the map to a neighborhood
2. **Food** — pick **Healthy** (green) for a live review hunt, up to 3 food types, and/or a keyword
3. **Results** — top 10 from OpenStreetMap, with “why recommended,” **Google / Yelp / TripAdvisor ratings**, website/menu links. Healthy mode also mines Yelp, Google, TripAdvisor, and OpenTable snippets for grass-fed, avocado oil, smoothie shops, and healthy salmon/chicken.
4. **My Taste** — mark Loved it / Not for me; profile stays in your browser (export/import JSON to move devices)
5. **Settings** — Google Places API key override; Yelp/TripAdvisor proxy URL (required for those ratings)

Access is through the andrewcamero.com lodge: you must be logged in (`ac_session`). Data from OpenStreetMap via Photon + Overpass.

### Google ratings setup (one-time)

1. **Enable Places API (New)** on your Google Cloud project
2. Restrict the key to HTTP referrer `https://hunt4food.andrewcamero.com/*`
3. Add **`VITE_GOOGLE_PLACES_API_KEY`** on Vercel (and never prefix lodge secrets with `VITE_`)
4. The app caps Google rating lookups at **40/day** and **400/month** automatically

### Ratings note

- **Google**: Places Text Search via build-time secret or Settings override; hard daily/monthly caps; **cached until midnight UTC** (no repeat API calls same day)
- **Yelp & TripAdvisor**: require a free [Google Apps Script proxy](scripts/ratings-proxy/README.md). Ratings are **cached per day** in your browser.

### Yelp / TripAdvisor setup (one-time)

1. Deploy `scripts/ratings-proxy/Code.gs` at [script.google.com](https://script.google.com) (see [README](scripts/ratings-proxy/README.md))
2. Add GitHub environment secret **`VITE_RATINGS_PROXY_URL`** = your `/exec` URL, **or** paste the URL in the app’s **Settings** page
3. Optional: add **`YELP_API_KEY`** in Apps Script properties for Yelp Fusion (recommended)
4. After updating `Code.gs`, redeploy the web app (**Deploy → Manage deployments → Edit → New version**) so TripAdvisor fixes take effect

## Lodge

Hunt4Food is a product behind the andrewcamero.com lodge (Base Camp). It does **not** host login, signup, or its own user database, and it follows the lodge's [product auth contract](https://github.com/DaKuY/andrewcamero.com-orchestrator/blob/main/docs/PRODUCT-AUTH-CONTRACT.md): Base Camp is the only verifier of `ac_session`.

| | |
| --- | --- |
| Origin | https://hunt4food.andrewcamero.com |
| Login | https://andrewcamero.com/login?next=https://hunt4food.andrewcamero.com |
| Cookie | `ac_session` (HttpOnly, set by Base Camp on `.andrewcamero.com`; never read in the browser) |
| Session check | `server/session.ts` forwards the cookie to `GET https://andrewcamero.com/api/session` (answers cached 15 s; outages never cached) |
| Access | Any logged-in lodge user (no Hunt4Food grant required) |
| Base Camp down | `503` with `Retry-After: 5`; never a login redirect |
| Catalog slug | `Hunt4Food` (not `food`) |
| Vercel | **this** Vite project only — not the lodge project |

The lodge catalog already has `Hunt4Food` (`live: true`, repo `DaKuY/Hunt4Food`). Do not add a second `apps.ts` row.

### Required env

Copy `.env.example` to `.env` (never commit `.env`). All values are non-secret:

```
COOKIE_DOMAIN=.andrewcamero.com
LODGE_ORIGIN=https://andrewcamero.com
APP_SLUG=Hunt4Food
```

**Do not add `AUTH_SECRET` to this Vercel project.** This app never verifies the cookie itself; if an older deployment still has the variable, delete it.

### Run against a local lodge

Run Base Camp on port 3000, then set `LODGE_ORIGIN=http://localhost:3000` and `COOKIE_DOMAIN=` (empty). `localhost` cookies are host-only and shared across ports, so a lodge session on `http://localhost:3000` is sent to `http://localhost:5173`.

```bash
npm install
npm run dev
npm test
npm run build
npm run preview   # also gated
```

Visiting this app without `ac_session` redirects to the lodge login. Node 22 LTS.

## Local development

```bash
npm install
npm run dev
```

Requires a running lodge (see above). Without a valid lodge session the UI never loads.

## Limits (honest)

- OpenStreetMap coverage varies by city; thin areas show a Google/Yelp fallback
- Review **scores** from Yelp/TripAdvisor need the Apps Script proxy; Google uses Places API
- Taste profiles are per-browser unless you export/import JSON
- Be polite to public Overpass/Photon services — the app caches and throttles

## Attribution

Place data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
