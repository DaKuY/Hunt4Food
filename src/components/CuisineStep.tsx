import { CUISINES, CUISINE_GROUPS, DIETARY_OPTIONS } from '../data/cuisines'
import { HEALTHY_FOCUS_OPTIONS } from '../lib/healthySignals'
import { KEYWORD_SUGGESTIONS } from '../lib/keyword'
import type { CuisineId, DietaryId, HealthyFocusId } from '../lib/types'

type Props = {
  selected: CuisineId[]
  keyword: string
  healthyFocus: HealthyFocusId[]
  onHealthyFocusChange: (focus: HealthyFocusId[]) => void
  dietary: DietaryId[]
  onDietaryChange: (dietary: DietaryId[]) => void
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
  healthyFocus,
  onHealthyFocusChange,
  dietary,
  onDietaryChange,
  onChange,
  onKeywordChange,
  onBack,
  onNext,
  cityLabel,
}: Props) {
  const healthyOn = selected.includes('healthy')
  const foodSelected: CuisineId[] = selected.filter((id) => id !== 'healthy')
  const trimmedKeyword = keyword.trim()
  const canProceed = selected.length > 0 || trimmedKeyword.length > 0

  function toggleHealthy() {
    if (healthyOn) {
      onChange(foodSelected)
      return
    }
    onChange(['healthy', ...foodSelected])
  }

  function toggleFocus(id: HealthyFocusId) {
    onHealthyFocusChange(healthyFocus.includes(id) ? healthyFocus.filter((f) => f !== id) : [...healthyFocus, id])
  }

  function toggleDietary(id: DietaryId) {
    onDietaryChange(dietary.includes(id) ? dietary.filter((d) => d !== id) : [...dietary, id])
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
          <>
            <h4 className="subhead small">What kind of healthy? <span className="muted">(optional, pick any)</span></h4>
            <div className="chip-row wrap" role="group" aria-label="Healthy focus">
              {HEALTHY_FOCUS_OPTIONS.map((option) => {
                const on = healthyFocus.includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`chip healthy ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    title={option.hint}
                    onClick={() => toggleFocus(option.id)}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            <p className="muted small">
              {healthyFocus.length
                ? `Showing only: ${HEALTHY_FOCUS_OPTIONS.filter((o) => healthyFocus.includes(o.id)).map((o) => o.label.toLowerCase()).join(', ')}.`
                : 'None picked shows a mix of all five.'}
            </p>
          </>
        ) : null}
        {healthyOn ? (
          <p className="healthy-helper">
            We check Google, Yelp, TripAdvisor, and OpenTable for grass-fed, clean oils, smoothie shops,
            and grass-fed steak, salmon, or chicken. Mentions show on each listing.
          </p>
        ) : (
          <p className="muted small">
            True Food Kitchen-style cooking, smoothie spots like Tropical Smoothie and Pure Green, and steak, salmon, or chicken options.
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

      <div className="cuisine-group">
        <h3 className="subhead">Preferences <span className="muted small">(remembered for next time)</span></h3>
        <div className="chip-row wrap" role="group" aria-label="Dietary preferences">
          {DIETARY_OPTIONS.map((option) => {
            const on = dietary.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                className={`chip ${on ? 'on' : ''}`}
                aria-pressed={on}
                title={option.hint}
                onClick={() => toggleDietary(option.id)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        <p className="muted small">Preferences move matching places up; they don&apos;t hide others.</p>
      </div>

      <label className="field keyword-field">
        <span>Anything else</span>
        <input
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canProceed) onNext()
          }}
          placeholder='e.g. "wild caught fish", "grass fed steak", "organic salad"'
          autoComplete="off"
        />
      </label>
      <div className="chip-row wrap">
        {KEYWORD_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className={`chip ghost ${keyword.toLowerCase() === suggestion ? 'on' : ''}`}
            onClick={() => onKeywordChange(keyword.toLowerCase() === suggestion ? '' : suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <p className="muted small">
        {selected.length > 0
          ? 'Optional if you picked Healthy or a food type — places whose name or listing mentions your phrase.'
          : 'Search by keyword alone, or combine with Healthy or food types above for tighter picks.'}
      </p>

      <div className="step-actions row">
        <button type="button" className="btn ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn primary" disabled={!canProceed} onClick={onNext}>
          Find 10 places
        </button>
      </div>
    </section>
  )
}
