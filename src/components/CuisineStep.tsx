import { CUISINES, CUISINE_GROUPS } from '../data/cuisines'
import { KEYWORD_SUGGESTIONS } from '../lib/keyword'
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

export function CuisineStep({
  selected,
  keyword,
  onChange,
  onKeywordChange,
  onBack,
  onNext,
  cityLabel,
}: Props) {
  function toggle(id: CuisineId) {
    if (selected.includes(id)) {
      onChange(selected.filter((c) => c !== id))
      return
    }
    if (selected.length >= 3) return
    onChange([...selected, id])
  }

  const trimmedKeyword = keyword.trim()
  const canProceed = selected.length > 0 || trimmedKeyword.length > 0

  return (
    <section className="step cuisine-step">
      <header className="step-header">
        <p className="eyebrow">Hunt4Food · Step 2 · {cityLabel}</p>
        <h2>What are you craving?</h2>
        <p className="lede">
          Pick up to three food types, type a keyword, or both. You can search with just a keyword if you
          don&apos;t know what cuisine you want.
        </p>
      </header>

      {CUISINE_GROUPS.map((group) => (
        <div key={group.id} className="cuisine-group">
          <h3 className="subhead">{group.label}</h3>
          <div className="chip-row wrap">
            {CUISINES.filter((c) => c.group === group.id).map((c) => {
              const on = selected.includes(c.id)
              const disabled = !on && selected.length >= 3
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${on ? 'on' : ''}`}
                  disabled={disabled}
                  onClick={() => toggle(c.id)}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <p className="muted">{selected.length}/3 selected — or skip and search by keyword only</p>

      <label className="field keyword-field">
        <span>Keyword search</span>
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
          ? 'Optional boost — places whose name or listing mentions your phrase.'
          : 'Search by keyword alone, or combine with food types above for tighter picks.'}
      </p>

      <div className="step-actions row">
        <button type="button" className="btn ghost" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!canProceed}
          onClick={onNext}
        >
          Find 10 places
        </button>
      </div>
    </section>
  )
}
