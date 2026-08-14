# Yelp & TripAdvisor ratings proxy

GitHub Pages is static — the browser cannot scrape Yelp or TripAdvisor directly (CORS + bot protection). This **Google Apps Script** acts as a free server-side proxy.

## Deploy (one-time, ~5 minutes)

1. Open [script.google.com](https://script.google.com) → **New project**
2. Delete the default `Code.gs` contents and paste everything from `Code.gs` in this folder → **Save**
3. **Project Settings** (gear) → **Script properties** → add:
   - `YELP_API_KEY` (optional but **strongly recommended**): create a free app at [Yelp Fusion](https://www.yelp.com/developers/v3/manage_app). Without it, Yelp may return no rating.
4. **Deploy** → **New deployment** → type **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the **`/exec`** URL (looks like `https://script.google.com/macros/s/…/exec`)

## Wire into OpenPlate

**Option A — GitHub Pages (recommended)**

1. Repo → **Settings** → **Environments** → **github-pages** → **Environment secrets**
2. Add `VITE_RATINGS_PROXY_URL` = your `/exec` URL
3. Re-run **Deploy GitHub Pages** workflow (or push to `main`)

**Option B — browser only (no redeploy)**

1. Open the live app → **Settings**
2. Paste the `/exec` URL under **Ratings proxy URL** → **Save**

## Test

In Settings, click **Test proxy**. You should see sample Yelp/TripAdvisor ratings within a few seconds.

TripAdvisor ratings use DuckDuckGo search snippets (TripAdvisor blocks direct scraping). **Redeploy** the web app after updating `Code.gs` so changes take effect.
