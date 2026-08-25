# Hunt4Food — Restaurant Finder

Hunt what’s good to eat nearby. Pick a place on the map, choose up to three cuisines, get ten ranked recommendations that taste great (including healthier picks), and open Google / Yelp / TripAdvisor for live reviews.

**Live app:** https://hunt4food.andrewcamero.com (lodge-gated; sign in at https://andrewcamero.com)

## What it does

1. **City** — type a name or zoom the map to a neighborhood
2. **Food** — pick **Healthy** (green) for a live review hunt, up to 3 food types, and/or a keyword
3. **Results** — top 10 from OpenStreetMap, with “why recommended,” **Google / Yelp / TripAdvisor ratings**, website/menu links. Healthy mode also mines Yelp, Google, TripAdvisor, and OpenTable snippets for grass-fed, avocado oil, smoothie shops, and healthy salmon/chicken.
4. **My Taste** — mark Loved it / Not for me; profile stays in your browser (export/import JSON to move devices)
5. **Settings** — Google Places API key override; Yelp/TripAdvisor proxy URL (required for those ratings)

Access is through the andrewcamero.com lodge (session cookie `ac_session` plus a Hunt4Food grant). Data from OpenStreetMap via Photon + Overpass.

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

Hunt4Food is a product behind the andrewcamero.com lodge. It does **not** host login, signup, or its own user database. JWT verification runs only on the server (`server/`, Vercel `middleware.ts`); `AUTH_SECRET` must never be prefixed with `VITE_` or `NEXT_PUBLIC_`.

`ORIGIN=https://hunt4food.andrewcamero.com`

| | |
| --- | --- |
| Origin | https://hunt4food.andrewcamero.com |
| Login | https://andrewcamero.com/login?next=https://hunt4food.andrewcamero.com |
| Missing grant | https://andrewcamero.com/?need=Hunt4Food |
| Cookie | `ac_session` (HS256 JWT, production domain `.andrewcamero.com`) |
| Catalog slug | `Hunt4Food` (not `food`) |
| Vercel | **this** Vite project only — not the lodge project |

Lodge catalog already has `Hunt4Food` (`origin` `https://hunt4food.andrewcamero.com`, repo `DaKuY/restaurant-finder`, `live: true`). Do not add a second `apps.ts` row and do not flip lodge live flags.

### Required env

Copy `.env.example` to `.env` (never commit `.env`):

```
AUTH_SECRET=<same value as the lodge>
COOKIE_DOMAIN=.andrewcamero.com
LODGE_ORIGIN=https://andrewcamero.com
APP_SLUG=Hunt4Food
```

Production Vercel env is the same four names (server-only).

### Run against a local lodge

Typical lodge on port 3000:

```
AUTH_SECRET=<same value as the local lodge>
COOKIE_DOMAIN=
LODGE_ORIGIN=http://localhost:3000
APP_SLUG=Hunt4Food
```

`localhost` cookies are host-only and shared across ports, so a lodge session on `http://localhost:3000` is sent to `http://localhost:5173`. Then:

```bash
npm install
npm run dev
```

Visiting this app without `ac_session` redirects to the lodge login. A signed-in **member** without a Hunt4Food grant is redirected to `/?need=Hunt4Food`. **Admin** (`admin: true` or `role=admin`, Andrew Camero) is allowed without a grant row. Members start with zero grants; hiding the catalog card is not enough.

Grant `Hunt4Food` on the lodge **Admin desk** for each member who should use the app.

```bash
npm test
npm run build
npm run preview
```

Preview is also gated. Node 22 LTS.

## Local development

```bash
npm install
npm run dev
```

Requires the Lodge env vars above. Without a valid lodge session the UI never loads.

## Limits (honest)

- OpenStreetMap coverage varies by city; thin areas show a Google/Yelp fallback
- Review **scores** from Yelp/TripAdvisor need the Apps Script proxy; Google uses Places API
- Taste profiles are per-browser unless you export/import JSON
- Be polite to public Overpass/Photon services — the app caches and throttles

## Attribution

Place data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
