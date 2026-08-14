import { useState } from 'react'
import { getGoogleQuota, googleQuotaMessage } from '../lib/googleQuota'
import { loadSettings, saveSettings } from '../lib/settings'

export function SettingsPage() {
  const [googleKey, setGoogleKey] = useState(() => loadSettings().googlePlacesApiKey)
  const [message, setMessage] = useState<string | null>(null)
  const quota = getGoogleQuota()

  function save() {
    saveSettings({ googlePlacesApiKey: googleKey.trim() })
    setMessage('Saved. Google ratings use your quota limits below.')
  }

  return (
    <section className="step settings-page">
      <header className="step-header">
        <p className="eyebrow">Settings</p>
        <h2>Ratings &amp; API keys</h2>
        <p className="lede">
          Google ratings use Places Text Search with strict daily/monthly caps so you stay within the
          free tier. Yelp and TripAdvisor load separately when possible.
        </p>
      </header>

      {message && <p className="banner">{message}</p>}

      <p className="banner">{googleQuotaMessage()}</p>
      <p className="muted small">
        Used today: {quota.dailyUsed} · Used this month: {quota.monthlyUsed}. Cached ratings do not
        count against the limit.
      </p>

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
        The site ships with a key for GitHub Pages. Override here only if needed. In Google Cloud,
        enable <strong>Places API (New)</strong>, restrict by HTTP referrer{' '}
        <code>https://dakuy.github.io/*</code>, and set a daily quota (e.g. 50) as a backup.
      </p>

      <button type="button" className="btn primary" onClick={save}>
        Save settings
      </button>
    </section>
  )
}
