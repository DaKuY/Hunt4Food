import { CUISINES, CUISINE_GROUPS } from '../data/cuisines'
import type { CuisineId } from '../lib/types'

type Props = {
  selected: CuisineId[]
  keyword: string
  onChange: (cuisines: CuisineId[]) => void
  onKeywordChange: (keyword: string) => void
  onBack: () => void
  onNext: () => void
  cityLabel: string
}

const FOOD_CAP = 3

export function CuisineStep({
  selected,
  keyword,
  onChange,
  onKeywordChange,
  onBack,
  onNext,
  cityLabel,
}: Props) {
  const healthyOn = selected.includes('healthy')
  const foodSelected: CuisineId[] = selected.filter((id) => id !== 'healthy')
  const canNext = selected.length > 0 || Boolean(keyword.trim())

  function toggleHealthy() {
    if (healthyOn) {
      onChange(foodSelected)
      return
    }
    onChange(['healthy', ...foodSelected])
  }

  function toggleFood(id: CuisineId) {
    if (foodSelected.includes(id)) {
      onChange(selected.filter((c) => c !== id))
      return
    }
    if (foodSelected.length >= FOOD_CAP) return
    onChange(healthyOn ? ['healthy', ...foodSelected, id] : [...foodSelected, id])
  }

  return (
    <section className="step cuisine-step">
      <header className="step-header">
        <p className="eyebrow">Hunt4Food · Step 2 · {cityLabel}</p>
        <h2>What are you craving?</h2>
        <p className="lede">
          Start with Healthy if you want a live review hunt, pick food types, type a keyword, or mix
          them. Any one of those is enough to search.
        </p>
      </header>

      <div className="cuisine-group healthy-group">
        <h3 className="subhead">Healthy</h3>
        <div className="chip-row wrap">
          <button
            type="button"
            className={`chip healthy ${healthyOn ? 'on' : ''}`}
            onClick={toggleHealthy}
          >
            Healthy
          </button>
        </div>
        {healthyOn ? (
          <p className="healthy-helper">
            We&apos;ll scan Google, Yelp, and OpenTable reviews for grass-fed, pasture-raised, no seed
            oils, avocado oil or butter, smoothie shops like Tropical Smoothie Cafe and Pure Green, and
            healthy salmon or chicken breast. If reviews mention those, they show on the listing.
          </p>
        ) : (
          <p className="muted small">
            True Food Kitchen-style cooking, smoothie shops, and healthy salmon or chicken options.
          </p>
        )}
      </div>

      {CUISINE_GROUPS.map((group) => (
        <div key={group.id} className="cuisine-group">
          <h3 className="subhead">{group.label}</h3>
          <div className="chip-row wrap">
            {CUISINES.filter((c) => c.group === group.id).map((c) => {
              const on = foodSelected.includes(c.id)
              const disabled = !on && foodSelected.length >= FOOD_CAP
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${on ? 'on' : ''}`}
                  disabled={disabled}
                  onClick={() => toggleFood(c.id)}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <p className="muted">
        {foodSelected.length}/{FOOD_CAP} food types
        {healthyOn ? ' · Healthy on' : ''} — or search with just a keyword
      </p>

      <label className="field keyword-field">
        <span>Anything else</span>
        <input
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canNext) onNext()
          }}
          placeholder='e.g. "wild caught fish", "grass fed steak", "organic salad"'
          autoComplete="off"
        />
      </label>
      <p className="muted small">
        Optional if you picked Healthy or a food type — or search with just this phrase.
      </p>

      <div className="step-actions row">
        <button type="button" className="btn ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn primary" disabled={!canNext} onClick={onNext}>
          Find 10 places
        </button>
      </div>
    </section>
  )
}
