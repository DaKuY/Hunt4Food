import { useRef, useState } from 'react'

type Props = {
  onAsk: (text: string) => void
  busy: boolean
  /** What was understood ("Healthy · salmon & seafood · near Coppell") or a problem to fix. */
  message: { kind: 'understood' | 'problem'; text: string } | null
  /** hero: the home screen. compact: above the picker and results. */
  variant?: 'hero' | 'compact'
  /** Where an unplaced search runs ("Coppell"); null means the phone's location. */
  areaLabel?: string | null
  /** Open the map / city picker. */
  onChangeArea?: () => void
}

/** Healthy first: one tap runs the search where you are. */
function quickPicks(areaLabel: string | null | undefined) {
  return [
    { label: areaLabel ? `Healthy near ${areaLabel}` : 'Healthy near me', query: 'healthy' },
    { label: 'True Food Kitchen', query: 'True Food Kitchen' },
    { label: 'Smoothies & açaí', query: 'smoothie and acai bowls' },
    { label: 'Wild salmon', query: 'salmon' },
    { label: 'Grass-fed', query: 'grass fed steak' },
    { label: 'No seed oils', query: 'healthy no seed oils' },
  ]
}

function SearchIcon() {
  return (
    <svg className="ask-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg className="ask-pin" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  )
}

/**
 * The main way to search: type what you want in plain words ("salmon bowl near Coppell",
 * "True Food Kitchen", "grass-fed burger no seed oils") or tap a healthy quick pick.
 */
export function AskBar({ onAsk, busy, message, variant = 'compact', areaLabel = null, onChangeArea }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const hero = variant === 'hero'

  function submit(value: string) {
    const trimmed = value.trim()
    if (busy) return
    if (!trimmed) {
      inputRef.current?.focus()
      return
    }
    // Drop the iPhone keyboard so the results are visible.
    inputRef.current?.blur()
    onAsk(trimmed)
  }

  return (
    <form
      className={`ask-bar ask-bar--${variant}`}
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        submit(text)
      }}
    >
      {hero ? (
        <header className="ask-hero-head">
          <p className="eyebrow">Hunt4Food</p>
          <h1 className="ask-title">What are you hungry for?</h1>
          <p className="ask-lede">
            Healthy first — True Food Kitchen–style spots, smoothie bowls, wild salmon, grass-fed and no seed
            oils — with the next best nearby when nothing is perfect.
          </p>
        </header>
      ) : null}
      <label className={hero ? 'visually-hidden' : 'ask-label'} htmlFor="ask-input">
        Search Hunt4Food
      </label>
      <div className="ask-row">
        <div className="ask-field">
          <SearchIcon />
          <input
            ref={inputRef}
            id="ask-input"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={hero ? 'e.g. “wild salmon”' : 'Search again…'}
          />
          {text ? (
            <button
              type="button"
              className="ask-clear"
              aria-label="Clear search"
              onClick={() => {
                setText('')
                inputRef.current?.focus()
              }}
            >
              ×
            </button>
          ) : null}
        </div>
        <button type="submit" className="btn primary ask-submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </div>
      <p className="ask-area">
        <PinIcon />
        <span>{areaLabel ? `Near ${areaLabel}` : 'Near your location'}</span>
        {onChangeArea ? (
          <button type="button" className="link-button" onClick={onChangeArea}>
            Choose an area
          </button>
        ) : null}
      </p>
      {message ? (
        <p className={message.kind === 'problem' ? 'ask-message problem' : 'ask-message'} aria-live="polite">
          {message.kind === 'understood' ? <>Searching for: <strong>{message.text}</strong></> : message.text}
        </p>
      ) : null}
      <div className="ask-picks" aria-label="Quick healthy searches">
        {quickPicks(areaLabel).map((pick) => (
          <button
            key={pick.label}
            type="button"
            className="chip ghost"
            disabled={busy}
            onClick={() => {
              setText(pick.query)
              submit(pick.query)
            }}
          >
            {pick.label}
          </button>
        ))}
      </div>
    </form>
  )
}
