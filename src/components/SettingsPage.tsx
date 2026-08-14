import { useState } from 'react'
import { getGoogleQuota, googleQuotaMessage } from '../lib/googleQuota'
import { jsonpGet, ratingsProxyConfigured, ratingsProxyUrl } from '../lib/ratingsProxy'
import { loadSettings, saveSettings } from '../lib/settings'

export function SettingsPage() {
  const initial = loadSettings()
  const [googleKey, setGoogleKey] = useState(() => initial.googlePlacesApiKey)
  const [proxyUrl, setProxyUrl] = useState(() => initial.ratingsProxyUrl)
  const [message, setMessage] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const quota = getGoogleQuota()

  function save() {
    saveSettings({
      googlePlacesApiKey: googleKey.trim(),
      ratingsProxyUrl: proxyUrl.trim(),
    })
    setMessage('Saved.')
    setTestResult(null)
  }

  async function testProxy() {
    const url = proxyUrl.trim() || ratingsProxyUrl()
    if (!url) {
      setTestResult('Add a proxy URL first (see instructions below).')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const settings = loadSettings()
      const googleParams: Record<string, string> = {
        source: 'google',
        name: 'Pizzeria',
        city: 'San Francisco',
        lat: '37.7749',
        lon: '-122.4194',
      }
      if (settings.googlePlacesApiKey) googleParams.googleKey = settings.googlePlacesApiKey

      const [yelp, ta, google] = await Promise.all([
        jsonpGet<{ rating?: number | null; reviewCount?: number | null; price?: string | null; error?: string }>(url, {
          source: 'yelp',
          name: 'Pizzeria',
          city: 'San Francisco',
          lat: '37.7749',
          lon: '-122.4194',
        }),
        jsonpGet<{ rating?: number | null; reviewCount?: number | null; error?: string }>(url, {
          source: 'tripadvisor',
          name: 'Pizzeria',
          city: 'San Francisco',
        }),
        jsonpGet<{ rating?: number | null; reviewCount?: number | null; priceLevel?: string | null; error?: string }>(
          url,
          googleParams,
        ),
      ])
      const yelpText =
        yelp.rating != null
          ? `Yelp ${yelp.rating}★${yelp.price ? ` ${yelp.price}` : ''}`
          : yelp.error || 'Yelp: no rating'
      const taText =
        ta.rating != null
          ? `TripAdvisor ${ta.rating}★ (${ta.reviewCount ?? '?'} reviews)`
          : ta.error || 'TripAdvisor: no rating'
      const googleText =
        google.rating != null
          ? `Google ${google.rating}★ (${google.reviewCount ?? '?'} reviews)`
          : google.error || 'Google: redeploy proxy with latest Code.gs'
      setTestResult(`${googleText} · ${yelpText} · ${taText}`)
    } catch (e) {
      setTestResult(`Proxy failed: ${(e as Error).message}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="step settings-page">
      <header className="step-header">
        <p className="eyebrow">Settings</p>
        <h2>Ratings &amp; API keys</h2>
        <p className="lede">
          Google ratings and price levels run through the Apps Script proxy (referrer-locked keys cannot call
          Google from the browser). Yelp and TripAdvisor use the same proxy. Redeploy Code.gs after updates.
        </p>
      </header>

      {message && <p className="banner">{message}</p>}

      <p className="banner">{googleQuotaMessage()}</p>
      <p className="muted small">
        Used today: {quota.dailyUsed} · Used this month: {quota.monthlyUsed}. Cached ratings do not count
        against the limit.
      </p>

      <h3 className="subhead">Google Places</h3>
      <label className="field">
        <span>Google Places API key (optional override)</span>
        <input
          type="password"
          value={googleKey}
          onChange={(e) => setGoogleKey(e.target.value)}
          placeholder="Leave blank to use the built-in site key"
          autoComplete="off"
        />
      </label>
      <p className="muted small">
        Enable <strong>Places API (New)</strong>, restrict by HTTP referrer{' '}
        <code>https://dakuy.github.io/*</code>, and set a daily quota (e.g. 50) as a backup.
      </p>

      <label className="field">
        <span>Yelp / TripAdvisor ratings proxy URL</span>
        <input
          type="url"
          value={proxyUrl}
          onChange={(e) => setProxyUrl(e.target.value)}
          placeholder={
            ratingsProxyConfigured()
              ? 'Using built-in site proxy (override here if needed)'
              : 'https://script.google.com/macros/s/…/exec'
          }
          autoComplete="off"
        />
      </label>
      {!ratingsProxyConfigured() && !proxyUrl.trim() && (
        <p className="banner warn">
          Yelp and TripAdvisor stars are hidden until you deploy the free proxy. See{' '}
          <code>scripts/ratings-proxy/README.md</code> in the repo, or follow the steps below.
        </p>
      )}
      <ol className="muted small setup-steps">
        <li>
          Open <a href="https://script.google.com">script.google.com</a> → New project → paste{' '}
          <code>scripts/ratings-proxy/Code.gs</code> → Save
        </li>
        <li>
          Project Settings → Script properties → add <code>YELP_API_KEY</code> (free at{' '}
          <a href="https://www.yelp.com/developers/v3/manage_app">Yelp Fusion</a>, recommended)
        </li>
        <li>Deploy → Web app → Execute as Me, access Anyone → copy the /exec URL here</li>
        <li>
          Optional: add the same URL as GitHub environment secret <code>VITE_RATINGS_PROXY_URL</code> so all
          visitors get ratings without visiting Settings
        </li>
      </ol>

      <div className="btn-row">
        <button type="button" className="btn primary" onClick={save}>
          Save settings
        </button>
        <button type="button" className="btn ghost" onClick={() => void testProxy()} disabled={testing}>
          {testing ? 'Testing…' : 'Test proxy'}
        </button>
      </div>
      {testResult && <p className="muted small">{testResult}</p>}
    </section>
  )
}
