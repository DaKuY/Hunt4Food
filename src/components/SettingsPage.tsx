import { useState } from 'react'
import { loadSettings, saveSettings } from '../lib/settings'

export function SettingsPage() {
  const [googleKey, setGoogleKey] = useState(() => loadSettings().googlePlacesApiKey)
  const [message, setMessage] = useState<string | null>(null)

  function save() {
    saveSettings({ googlePlacesApiKey: googleKey.trim() })
    setMessage('Saved. Google ratings will load on your next search.')
  }

  return (
    <section className="step settings-page">
      <header className="step-header">
        <p className="eyebrow">Settings</p>
        <h2>Ratings &amp; API keys</h2>
        <p className="lede">
          Yelp and TripAdvisor ratings load automatically when possible. For reliable Google star ratings,
          add a free Google Places API key (stored only in this browser).
        </p>
      </header>

      {message && <p className="banner">{message}</p>}

      <label className="field">
        <span>Google Places API key (optional)</span>
        <input
          type="password"
          value={googleKey}
          onChange={(e) => setGoogleKey(e.target.value)}
          placeholder="AIza…"
          autoComplete="off"
        />
      </label>
      <p className="muted small">
        Create one at{' '}
        <a href="https://console.cloud.google.com/google/maps-apis/" target="_blank" rel="noreferrer">
          Google Cloud Console
        </a>
        . Enable <strong>Places API (New)</strong>, restrict the key to HTTP referrers including{' '}
        <code>dakuy.github.io</code>, and set a daily quota.
      </p>

      <button type="button" className="btn primary" onClick={save}>
        Save settings
      </button>
    </section>
  )
}
